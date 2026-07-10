/**
 * ButtonSfx.ts
 * 按钮音效组件 —— 单一职责：只管听觉反馈
 *
 * 职责分工：
 *   ButtonHover  → 视觉反馈（上浮 + 描边 + 光标）
 *   ButtonSfx    → 听觉反馈（hover 音 + click 音）
 *
 * 用法：
 *   挂到与 ButtonHover 相同的节点上，属性面板拖入对应 AudioClip。
 *   hoverSfx / clickSfx 任一留空则跳过，不报错。
 *
 * 注意：
 *   依赖 AudioManager.instance（不灭根单例），无需额外引用。
 *   音量由 SettingsManager.sfxVolume 统一控制，此处无需设置。
 */

import { _decorator, Component, Node, AudioClip } from 'cc';
import { AudioManager } from '../core/AudioManager';

const { ccclass, property } = _decorator;

@ccclass('ButtonSfx')
export class ButtonSfx extends Component {

    @property({ type: AudioClip, tooltip: '鼠标悬停时播放的音效（约 80ms 短促音）' })
    hoverSfx: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: '点击/触碰时播放的音效（约 120ms 确认音）' })
    clickSfx: AudioClip | null = null;

    @property({ tooltip: 'hover 音效音量缩放（0~1），用于区分不同按钮的响度' })
    hoverVolumeScale: number = 0.6;

    @property({ tooltip: 'click 音效音量缩放（0~1），用于区分不同按钮的响度' })
    clickVolumeScale: number = 1.0;

    @property({ tooltip: 'hover 音效冷却时间（秒），防止快速滑动时高频触发挤断 BGM' })
    hoverCooldown: number = 0.08;

    // ==================== 私有 ====================

    private _hoverLocked: boolean = false;

    // ==================== 生命周期 ====================

    onEnable(): void {
        this.node.on(Node.EventType.MOUSE_ENTER, this._onHover, this);
        this.node.on(Node.EventType.TOUCH_START,  this._onClick, this);
        // PC 鼠标点击（非触屏）
        this.node.on(Node.EventType.MOUSE_DOWN,   this._onClick, this);
    }

    onDisable(): void {
        this.node.off(Node.EventType.MOUSE_ENTER, this._onHover, this);
        this.node.off(Node.EventType.TOUCH_START,  this._onClick, this);
        this.node.off(Node.EventType.MOUSE_DOWN,   this._onClick, this);
    }

    // ==================== 私有 ====================

    private _onHover(): void {
        if (this._hoverLocked || !this.hoverSfx) return;
        this._hoverLocked = true;
        AudioManager.instance.playSfx(this.hoverSfx, this.hoverVolumeScale);
        this.scheduleOnce(() => { this._hoverLocked = false; }, this.hoverCooldown);
    }

    private _onClick(): void {
        if (this.clickSfx) {
            AudioManager.instance.playSfx(this.clickSfx, this.clickVolumeScale);
        }
    }
}
