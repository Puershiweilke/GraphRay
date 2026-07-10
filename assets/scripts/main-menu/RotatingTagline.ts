/**
 * RotatingTagline.ts
 * 主菜单文案轮播组件 —— 控制 Label 文字淡入淡出轮播
 *
 * 用法：挂到轮播卡片的父节点上。Label 引用指向子节点的 Label 组件。
 *       卡片的背景（圆角矩形）在编辑器里用 Graphics 或 Sprite 搭好，
 *       本组件不负责绘制背景。
 */

import { _decorator, Component, Label, Color } from 'cc';

const { ccclass, property } = _decorator;

// ======================== 可调参数 ========================

/** 轮播文案池 */
const TAGLINES: string[] = [
    '每一个公式，都是一颗子弹',
    '你的函数，就是武器',
    '数学课没有教你的——致命用法',
    '这道题，只有一个答案',
    '正弦波的终点，是你的位置',
    '证毕。',
    '先开枪的人，永远在微积分上输了',
];

/** 每条文案静态展示时长（秒） */
const HOLD_DURATION = 3.0;

/** 淡入淡出过渡时长（秒） */
const FADE_DURATION = 0.4;

/** 文字颜色 */
const TEXT_COLOR = new Color(229, 229, 229); // #E5E5E5

// ======================== 组件 ========================

enum State {
    Hold,
    FadeOut,
    FadeIn,
}

@ccclass('RotatingTagline')
export class RotatingTagline extends Component {

    @property({ type: Label, tooltip: '显示文案的 Label 子节点' })
    label: Label | null = null;

    private state: State = State.Hold;
    private timer: number = 0;
    private currentIndex: number = 0;

    onLoad() {
        if (this.label && TAGLINES.length > 0) {
            this.label.string = TAGLINES[0];
        }
    }

    update(dt: number) {
        if (!this.label || TAGLINES.length === 0) return;

        this.timer += dt;

        switch (this.state) {
            case State.Hold:
                if (this.timer >= HOLD_DURATION) {
                    this.state = State.FadeOut;
                    this.timer = 0;
                }
                break;

            case State.FadeOut: {
                const t = Math.min(this.timer / FADE_DURATION, 1);
                this.setLabelAlpha(1 - t);
                if (t >= 1) {
                    this.currentIndex = (this.currentIndex + 1) % TAGLINES.length;
                    this.label.string = TAGLINES[this.currentIndex];
                    this.state = State.FadeIn;
                    this.timer = 0;
                }
                break;
            }

            case State.FadeIn: {
                const t = Math.min(this.timer / FADE_DURATION, 1);
                this.setLabelAlpha(t);
                if (t >= 1) {
                    this.setLabelAlpha(1);
                    this.state = State.Hold;
                    this.timer = 0;
                }
                break;
            }
        }
    }

    private setLabelAlpha(a: number): void {
        const c = TEXT_COLOR.clone();
        c.a = Math.round(Math.max(0, Math.min(1, a)) * 255);
        this.label!.color = c;
    }
}
