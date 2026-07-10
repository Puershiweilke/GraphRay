/**
 * MainMenuBootstrap.ts
 * 主菜单场景入口脚本 —— 仅负责主菜单场景的初始化
 *
 * 职责：
 *   1. 从 localStorage 恢复设置项持久化值
 *   2. 触发 AudioManager 单例创建（不灭根持久化）
 *   3. 播放主菜单专属 BGM
 *   4. 创建设置面板（SettingsPanel），绑定 BtnSetting 点击
 *
 * 作用域：本脚本仅服务于主菜单场景，不承担跨场景初始化职责。
 *        其他场景需各自实现自己的入口脚本（如 BattleBootstrap）。
 *
 * 用法：挂到 Canvas 节点上，拖入 BGM AudioClip 即可。
 *      AudioManager 节点自动创建并挂 game.addPersistRootNode()。
 */

import { _decorator, Component, AudioClip, Node, UITransform, Button, director } from 'cc';
import { AudioManager } from '../core/AudioManager';
import { SettingsManager } from '../core/SettingsManager';
import { SettingsPanel } from './SettingsPanel';
import { FontManager } from '../core/FontManager';

const { ccclass, property } = _decorator;

@ccclass('MainMenuBootstrap')
export class MainMenuBootstrap extends Component {

    @property({ type: AudioClip, tooltip: '主菜单 BGM（neon_synthwave_drive）' })
    bgmClip: AudioClip | null = null;

    async onLoad(): Promise<void> {
        // 1. 从 localStorage 恢复持久化设置（必须在 AudioManager 之前）
        SettingsManager.getInstance();

        // 2. 触发 AudioManager 单例创建（自建 persistRootNode）
        const am = AudioManager.instance;

        if (this.bgmClip) {
            am.initBgm(this.bgmClip);
        } else {
            console.warn('[MainMenuBootstrap] bgmClip 未设置，BGM 不会自动播放');
        }

        // 3. 创建设置面板（隐藏状态，点击 BtnSetting 时弹出）
        this._setupSettingsPanel();

        // 4. 绑定按钮跳转
        this._bindButtons();

        // 5. 统一全局字体为 Orbitron（建完场景 Label 后套用）
        await FontManager.use(this.node);
    }

    // ==================== 按钮绑定 ====================

    private _bindButtons(): void {
        const canvas = this.node;
        const buttons = canvas.getChildByName('Buttons');

        // BtnChallenge → 关卡选择场景
        const challengeBtn = buttons?.getChildByName('BtnChallenge');
        if (challengeBtn) {
            challengeBtn.on(Node.EventType.TOUCH_END, () => {
                director.loadScene('level-select');
            });
        } else {
            console.warn('[MainMenuBootstrap] 未找到 BtnChallenge 节点');
        }
    }

    // ==================== 设置面板 ====================

    private _setupSettingsPanel(): void {
        const canvas = this.node;

        // 创建 SettingsPanel 节点（全屏覆盖层）
        const spNode = new Node('SettingsPanel');
        spNode.addComponent(UITransform).setContentSize(1920, 1080);
        spNode.layer = canvas.layer;
        canvas.addChild(spNode);

        const settingsPanel = spNode.addComponent(SettingsPanel);

        // 绑定 BtnSetting 点击 → 弹出设置面板
        // BtnSetting 在 Canvas > Buttons > BtnSetting，不是直接子节点
        const buttons = canvas.getChildByName('Buttons');
        const settingBar = buttons?.getChildByName('BtnSetting') ?? null;
        if (settingBar) {
            const btn = settingBar.getComponent(Button);
            if (btn) {
                btn.node.on(Button.EventType.CLICK, () => settingsPanel.show());
            }
        } else {
            console.warn('[MainMenuBootstrap] 未找到 BtnSetting 节点');
        }
    }
}
