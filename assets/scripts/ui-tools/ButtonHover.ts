/**
 * ButtonHover.ts
 * 按钮 Hover / Press 动效 + 鼠标光标切换
 *
 * Hover（PC）：上浮 + 卡片发光/描边变色 + 光标变小手
 * Press：压回原位（不缩放，0.4s 过渡回落）
 *
 * 用法：挂到带 Button 组件的节点上。cardBg 关联同节点 CardBackground。
 */

import { _decorator, Component, Button, Node, tween, Color, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('ButtonHover')
export class ButtonHover extends Component {

    @property({ tooltip: 'Hover 时上浮像素量' })
    floatPx: number = 4;

    @property({ tooltip: '动画时长（秒）' })
    duration: number = 0.4;

    @property({ tooltip: 'Hover 时描边色（配合 cardBg，Alpha>0 生效）' })
    hoverStroke: Color = new Color(158, 255, 0, 0);

    @property({ tooltip: '是否启用外发光（配合 cardBg）' })
    enableGlow: boolean = false;

    /** 关联的卡片背景（属性面板拖入 CardBackground 组件） */
    @property({ tooltip: '拖入同节点的 CardBackground 组件' })
    cardBg: any = null;

    @property({ tooltip: '是否管理鼠标光标（Web/Desktop 悬停变小手）' })
    manageCursor: boolean = true;

    // ---- 私有 ----

    private _idlePos: Vec3 = new Vec3();
    private _hoverPos: Vec3 = new Vec3();
    private _hovered: boolean = false;
    private _pressed: boolean = false;
    private _tween: any = null;
    private _canvas: HTMLCanvasElement | null = null;

    onLoad() {
        // 只存一次空闲位置，防止"来回触碰向上蠕动"
        this._idlePos = this.node.position.clone();
        this._hoverPos = new Vec3(this._idlePos.x, this._idlePos.y + this.floatPx, this._idlePos.z);

        // 拿到 canvas 元素用于改光标
        const game: any = (globalThis as any).cc?.game;
        this._canvas = game?.canvas ?? document.querySelector('canvas');
    }

    onEnable() {
        this.node.on(Node.EventType.MOUSE_ENTER, this.onEnter, this);
        this.node.on(Node.EventType.MOUSE_LEAVE, this.onLeave, this);
        this.node.on(Node.EventType.TOUCH_START, this.onPress, this);
        this.node.on(Node.EventType.TOUCH_END,   this.onRelease, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onRelease, this);
    }

    onDisable() {
        this.node.off(Node.EventType.MOUSE_ENTER, this.onEnter, this);
        this.node.off(Node.EventType.MOUSE_LEAVE, this.onLeave, this);
        this.node.off(Node.EventType.TOUCH_START, this.onPress, this);
        this.node.off(Node.EventType.TOUCH_END,   this.onRelease, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onRelease, this);
        this.stopTween();
        this._setCursor('default');
    }

    // ==================== 事件 ====================

    private onEnter() {
        this._hovered = true;
        if (!this._pressed) {
            this.floatUp();
        }
        if (this.cardBg) {
            if (this.hoverStroke.a > 0) this.cardBg.setStrokeColor(this.hoverStroke);
            if (this.enableGlow) this.cardBg.showGlow();
        }
        this._setCursor('pointer');
    }

    private onLeave() {
        this._hovered = false;
        if (!this._pressed) {
            this.floatDown();
        }
        if (this.cardBg) {
            this.cardBg.resetStrokeColor();
            this.cardBg.hideGlow();
        }
        this._setCursor('default');
    }

    private onPress() {
        this._pressed = true;
        this.stopTween();
        // 过渡回落原位（0.4s），不缩放
        this._tween = tween(this.node)
            .to(this.duration, { position: this._idlePos }, { easing: 'backOut' })
            .call(() => this._tween = null)
            .start();
    }

    private onRelease() {
        this._pressed = false;
        this.stopTween();
        if (this._hovered) {
            this.floatUp();
        } else {
            this.floatDown();
        }
    }

    // ==================== 动画 ====================

    private floatUp(): void {
        this.stopTween();
        this._tween = tween(this.node)
            .to(this.duration, { position: this._hoverPos }, { easing: 'backOut' })
            .call(() => this._tween = null)
            .start();
    }

    private floatDown(): void {
        this.stopTween();
        this._tween = tween(this.node)
            .to(this.duration, { position: this._idlePos }, { easing: 'backOut' })
            .call(() => this._tween = null)
            .start();
    }

    private stopTween(): void {
        if (this._tween) {
            this._tween.stop();
            this._tween = null;
        }
    }

    /** 修改 canvas 光标样式（仅 Web/Desktop，小游戏跳过） */
    private _setCursor(type: string): void {
        if (this.manageCursor && this._canvas) {
            this._canvas.style.cursor = type;
        }
    }
}
