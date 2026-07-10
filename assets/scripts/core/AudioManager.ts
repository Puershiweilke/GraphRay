/**
 * AudioManager.ts
 * 音频管理器 —— 不灭根单例，跨场景持久
 *
 * 职责：
 *   1. BGM 播放/暂停/恢复/停止
 *   2. SFX 音效播放
 *   3. 自动订阅 SettingsManager.bgmVolume / sfxVolume，数值绑定
 *   4. 通过 game.addPersistRootNode() 确保切场景不断
 *
 * 用法：
 *   // 初始化（入口场景 onLoad 调用一次）
 *   AudioManager.instance.initBgm(bgmClip);
 *
 *   // 切换场景时换 BGM（淡入淡出）
 *   AudioManager.instance.switchBgm(battleBgmClip);
 *
 *   // 读取当前播放时间（GridBackground 需要）
 *   AudioManager.instance.currentTime;
 *
 *   // 播放音效
 *   AudioManager.instance.playSfx(clickClip);
 */

import { _decorator, Component, AudioSource, AudioClip, Node, game, tween, Tween } from 'cc';
import { SettingsManager } from './SettingsManager';

const { ccclass, property } = _decorator;

@ccclass('AudioManager')
export class AudioManager extends Component {

    private static _instance: AudioManager | null = null;

    /** 获取单例（首次调用自动创建 persistRootNode） */
    static get instance(): AudioManager {
        if (!AudioManager._instance) {
            const node = new Node('AudioManager');
            game.addPersistRootNode(node);
            AudioManager._instance = node.addComponent(AudioManager);
        }
        return AudioManager._instance;
    }

    // ---- 属性 ----

    @property({ type: AudioClip, tooltip: 'BGM 音频剪辑（通过 initBgm 设置）' })
    bgmClip: AudioClip | null = null;

    // ---- 私有 ----

    private _bgmSource: AudioSource | null = null;
    private _sfxNode: Node | null = null;
    private _sfxPool: AudioSource[] = [];
    private _sfxPoolIndex: number = 0;
    private static readonly SFX_POOL_SIZE = 8;

    // ==================== 生命周期 ====================

    onLoad(): void {
        // 防重复创建
        if (AudioManager._instance && AudioManager._instance !== this) {
            this.node.destroy();
            return;
        }
        AudioManager._instance = this;

        // 创建 BGM AudioSource
        this._bgmSource = this.node.addComponent(AudioSource);

        // 创建 SFX 专用子节点，并预创建 AudioSource 池（隔离 BGM，避免高频 addComponent 过载 Web Audio）
        this._sfxNode = new Node('SfxPlayer');
        this.node.addChild(this._sfxNode);
        for (let i = 0; i < AudioManager.SFX_POOL_SIZE; i++) {
            const src = this._sfxNode.addComponent(AudioSource);
            src.loop = false;
            src.playOnAwake = false;
            this._sfxPool.push(src);
        }
        this._bgmSource.loop = true;
        this._bgmSource.playOnAwake = false;

        // 与 SettingsManager 数值绑定
        this._syncBgmVolume(SettingsManager.bgmVolume.value);
        this._syncSfxVolume(SettingsManager.sfxVolume.value);
        SettingsManager.bgmVolume.on(this._onBgmVolumeChange, this);
        SettingsManager.sfxVolume.on(this._onSfxVolumeChange, this);
    }

    onDestroy(): void {
        SettingsManager.bgmVolume.off(this._onBgmVolumeChange, this);
        SettingsManager.sfxVolume.off(this._onSfxVolumeChange, this);
        if (AudioManager._instance === this) AudioManager._instance = null;
    }

    // ==================== 公开 API ====================

    /** 当前 BGM 播放时间（秒），供 GridBackground 包络采样 */
    get currentTime(): number {
        return this._bgmSource?.currentTime ?? 0;
    }

    /** BGM 是否正在播放 */
    get isBgmPlaying(): boolean {
        return this._bgmSource?.playing ?? false;
    }

    /** 初始化并播放 BGM（入口场景调用一次） */
    initBgm(clip: AudioClip): void {
        this.bgmClip = clip;
        if (!this._bgmSource) return;

        if (this._bgmSource.playing) {
            if (this._bgmSource.clip === clip) return; // 已在播放同一曲目
            this._bgmSource.stop();
        }

        this._bgmSource.clip = clip;
        this._bgmSource.volume = SettingsManager.bgmVolume.value;
        this._bgmSource.play();
    }

    /** 暂停 BGM */
    pauseBgm(): void {
        this._bgmSource?.pause();
    }

    /** 恢复 BGM */
    resumeBgm(): void {
        if (this._bgmSource && this.bgmClip) {
            if (!this._bgmSource.playing) this._bgmSource.play();
        }
    }

    /** 停止 BGM */
    stopBgm(): void {
        this._bgmSource?.stop();
    }

    /** 切换 BGM（淡出当前 → 换 clip → 淡入），默认 0.5s 过渡 */
    switchBgm(clip: AudioClip, fadeDuration: number = 0.5): void {
        if (!this._bgmSource) return;

        // 已在播放同一曲目，不重复切换
        if (this._bgmSource.playing && this._bgmSource.clip === clip) return;

        // 停止当前淡入淡出动画，防止叠加
        Tween.stopAllByTarget(this._bgmSource);

        const src = this._bgmSource;
        const targetVolume = SettingsManager.bgmVolume.value;

        const doSwitch = (): void => {
            this.bgmClip = clip;
            src.stop();
            src.clip = clip;
            src.volume = 0;
            src.play();
            tween(src).to(fadeDuration, { volume: targetVolume }).start();
        };

        // 当前无 BGM 在播，直接切入（跳过淡出）
        if (!src.playing) {
            doSwitch();
            return;
        }

        // 淡出 → 切换 → 淡入
        tween(src)
            .to(fadeDuration, { volume: 0 })
            .call(doSwitch)
            .start();
    }

    /** 播放单次音效（从预创建池中轮转复用 AudioSource，零 GC 压力） */
    playSfx(clip: AudioClip, volumeScale: number = 1.0): void {
        if (!this._sfxNode || this._sfxPool.length === 0) return;
        const src = this._sfxPool[this._sfxPoolIndex];
        this._sfxPoolIndex = (this._sfxPoolIndex + 1) % this._sfxPool.length;
        src.stop(); // 复用前停止该槽位正在播放的音效
        src.clip = clip;
        src.volume = SettingsManager.sfxVolume.value * volumeScale;
        src.play();
    }

    /** 设置 BGM 音量（0~1），同步更新 SettingItem */
    setBgmVolume(v: number): void {
        SettingsManager.bgmVolume.value = v;
    }

    /** 设置音效音量（0~1），同步更新 SettingItem */
    setSfxVolume(v: number): void {
        SettingsManager.sfxVolume.value = v;
    }

    // ==================== 私有 ====================

    private _syncBgmVolume(v: number): void {
        if (this._bgmSource) {
            Tween.stopAllByTarget(this._bgmSource);
            this._bgmSource.volume = v;
        }
    }

    private _syncSfxVolume(_v: number): void {
        // SFX 音量在 playSfx 时读取，无需维护状态
    }

    // ---- SettingItem 回调（箭头函数保 this） ----

    private _onBgmVolumeChange = (v: number): void => {
        this._syncBgmVolume(v);
    };

    private _onSfxVolumeChange = (_v: number): void => {
        this._syncSfxVolume(_v);
    };
}
