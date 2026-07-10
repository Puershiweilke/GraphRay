/**
 * CursorStyle.ts
 * 鼠标悬停时改变系统光标样式
 *
 * 仅 Web / Desktop 平台生效（小游戏无 CSS cursor 概念，自动跳过）。
 *
 * 用法：挂到任意需要悬停光标的节点上。
 *   - 按钮 → cursorType 选 'pointer'（小手）
 *   - 文字链接 → 'pointer'
 *   - 输入框 → 'text'（I 型光标）
 */

import { _decorator, Component, Node, Enum } from 'cc';
import { PlatformDetector } from '../core/PlatformDetector';

const { ccclass, property } = _decorator;

/** 支持的 CSS cursor 值 */
export enum CursorType {
    Pointer = 'pointer',   // 小手（按钮/链接）
    Text    = 'text',      // I 型（文本输入）
    Default = 'default',   // 默认箭头
    Move    = 'move',      // 移动
    Grab    = 'grab',      // 抓取
}

@ccclass('CursorStyle')
export class CursorStyle extends Component {

    @property({ type: Enum(CursorType), tooltip: '悬停时光标样式' })
    cursorType: CursorType = CursorType.Pointer;

    private _canvas: HTMLCanvasElement | null = null;

    onLoad(): void {
        // 小游戏环境没有 CSS cursor，直接跳过
        if (PlatformDetector.isMiniGame) {
            this.enabled = false;
            return;
        }

        // 拿到 Cocos 渲染的 canvas 元素
        const game: any = (globalThis as any).cc?.game;
        this._canvas = game?.canvas ?? document.querySelector('canvas');
    }

    onEnable(): void {
        if (!this._canvas) return;
        this.node.on(Node.EventType.MOUSE_ENTER, this._onEnter, this);
        this.node.on(Node.EventType.MOUSE_LEAVE, this._onLeave, this);
    }

    onDisable(): void {
        if (!this._canvas) return;
        this.node.off(Node.EventType.MOUSE_ENTER, this._onEnter, this);
        this.node.off(Node.EventType.MOUSE_LEAVE, this._onLeave, this);
        // 还原为默认光标，防止 disable 时光标卡住
        this._setCursor(CursorType.Default);
    }

    // ==================== 内部 ====================

    private _onEnter(): void {
        this._setCursor(this.cursorType);
    }

    private _onLeave(): void {
        this._setCursor(CursorType.Default);
    }

    private _setCursor(type: string): void {
        if (this._canvas) {
            this._canvas.style.cursor = type;
        }
    }
}
