/**
 * FunctionWave.ts
 * 主菜单正弦波曲线组件 —— 多函数轮播 + 像素级 morph 过渡
 *
 * 用法：挂到带 Graphics 组件的节点上，节点尺寸 840×140。
 *       节点锚点居中 (0.5, 0.5)，组件自动从节点上获取 Graphics。
 *
 * 原理：
 *   0. 每次 onLoad 用 Fisher-Yates 打乱播放顺序并随机起播点，使每次进入主界面展示的函数与顺序都不同（避免被误认为静态装饰）
 *   1. 预采样每个函数在固定 x 范围内的 280 个点，归一化到 [-1, 1]
 *   2. HOLD 阶段（3s）：直接画当前函数
 *   3. MORPH 阶段（1.5s）：对上一个函数和下一个函数的 y 数组做逐点线性插值（带缓动）
 *   4. 每帧 Graphics.clear() + 重绘 4 层（Y轴线 / X轴虚线 / 呼吸辉光 / 主线）
 *   5. 辉光层透明度与线宽随 sin(time) 缓慢脉动（周期 5s），营造呼吸感
 */

import { _decorator, Component, Graphics, Color, Label } from 'cc';

const { ccclass, property } = _decorator;

// ======================== 可调参数 ========================

/** 采样点数（840px 宽，约每 3px 一个点） */
const SAMPLE_COUNT = 280;

/** 函数采样的 x 范围（[-4π, 4π]，让 sin 刚好显示 4 个周期） */
const X_MIN = -4 * Math.PI;
const X_MAX = 4 * Math.PI;

/** 绘制区域（与设计规范 840×140 对齐） */
const HALF_WIDTH = 420;   // 840 / 2
const HALF_HEIGHT = 70;   // 140 / 2
const AMPLITUDE = 50;     // 曲线振幅 50px（上下各留 20px 边距）

/** 配色（与设计规范一致） */
const COLOR = new Color(158, 255, 0); // #9EFF00 荧光绿

// ======================== 函数库 ========================

interface FuncDef {
    display: string;        // 显示的数学表达式（用于 Label 渲染）
    fn: (x: number) => number;
}

/**
 * 10 个函数：基础 + 数学史著名/优美函数
 * 去掉了 cos(x)（与 sin 太像）
 * display 用 Unicode 做基本排版（²=U+00B2, ³=U+00B3, ·=U+00B7）
 */
const FUNCTIONS: FuncDef[] = [
    { display: 'sin(x)',          fn: (x) => Math.sin(x) },
    { display: 'x\u00B2',         fn: (x) => x * x },
    { display: 'x\u00B3',         fn: (x) => x * x * x },
    { display: '|x|',             fn: (x) => Math.abs(x) },
    { display: 'e^(-x\u00B2)',    fn: (x) => Math.exp(-x * x) },
    { display: 'sin(x)/x',        fn: (x) => Math.abs(x) < 1e-6 ? 1 : Math.sin(x) / x },
    { display: '1/(1+e^(-x))',    fn: (x) => 1 / (1 + Math.exp(-x)) },
    { display: 'tanh(x)',         fn: (x) => Math.tanh(x) },
    { display: 'sin(x\u00B2)',    fn: (x) => Math.sin(x * x) },
    { display: 'x\u00B7sin(1/x)', fn: (x) => Math.abs(x) < 1e-4 ? 0 : x * Math.sin(1 / x) },
];

// ======================== 工具函数 ========================

/**
 * 对单个函数采样并归一化到 [-1, 1]
 * 归一化方式：找到 y 的 min/max，线性映射到 [-1, 1]
 * 这样每个函数都能完整填满画面高度，形状特征保留
 */
function sampleAndNormalize(fn: (x: number) => number): Float32Array {
    const raw = new Float32Array(SAMPLE_COUNT);
    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < SAMPLE_COUNT; i++) {
        const x = X_MIN + (X_MAX - X_MIN) * i / (SAMPLE_COUNT - 1);
        let y = fn(x);
        if (!isFinite(y)) y = 0; // 安全兜底
        raw[i] = y;
        if (y < min) min = y;
        if (y > max) max = y;
    }

    const range = max - min || 1; // 防除零
    const result = new Float32Array(SAMPLE_COUNT);
    for (let i = 0; i < SAMPLE_COUNT; i++) {
        result[i] = 2 * (raw[i] - min) / range - 1; // 映射到 [-1, 1]
    }
    return result;
}

/** easeInOutCubic 缓动，让 morph 过渡更自然 */
function easeInOutCubic(t: number): number {
    return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ======================== 组件 ========================

enum State {
    Hold,    // 静态展示当前函数
    Morph,   // 过渡到下一个函数
}

@ccclass('FunctionWave')
export class FunctionWave extends Component {

    @property({ type: Graphics, tooltip: 'Graphics 组件（同节点自动获取，也可手动拖入）' })
    graphics: Graphics | null = null;

    @property({ type: Label, tooltip: '显示函数表达式的 Label（可选，不设置则不显示）' })
    label: Label | null = null;

    // ---- 呼吸辉光（属性面板可调） ----

    @property({ tooltip: '启用呼吸辉光' })
    enableBreathing: boolean = true;

    @property({ tooltip: '呼吸周期（秒）', visible() { return (this as any).enableBreathing; } })
    breathePeriod: number = 3.0;

    @property({ tooltip: '辉光透明度下限（0~1）', visible() { return (this as any).enableBreathing; } })
    glowAlphaMin: number = 0.04;

    @property({ tooltip: '辉光透明度上限（0~1）', visible() { return (this as any).enableBreathing; } })
    glowAlphaMax: number = 0.14;

    @property({ tooltip: '辉光线宽下限（px）', visible() { return (this as any).enableBreathing; } })
    glowWidthMin: number = 10;

    @property({ tooltip: '辉光线宽上限（px）', visible() { return (this as any).enableBreathing; } })
    glowWidthMax: number = 18;

    // ---- 函数切换 ----

    @property({ tooltip: '单个函数静态展示时长（秒）' })
    holdDuration: number = 3.0;

    @property({ tooltip: '函数间 morph 过渡时长（秒）' })
    morphDuration: number = 1.5;

    @property({ tooltip: '标签淡入淡出分段点（0~1），表示旧文本淡出完成时占 morph 总进度的比例' })
    labelFadePoint: number = 0.4;

    // 运行时状态
    private state: State = State.Hold;
    private timer: number = 0;
    /** 当前 / 来源 在「播放序列 order」中的位置（非函数索引，需经 _oi 解析） */
    private currentIndex: number = 0;
    private fromIndex: number = 0;
    /** 已打乱的播放序列：函数索引的排列，每次 onLoad 重新洗牌；currentIndex/fromIndex 是其位置 */
    private order: number[] = [];

    /** 总运行时间（不重置），驱定呼吸辉光 */
    private _totalTime: number = 0;

    // 预计算：每个函数的归一化 y 数组
    private normalized: Float32Array[] = [];

    // 复用的插值 buffer（避免每帧 GC）
    private morphBuffer: Float32Array = new Float32Array(SAMPLE_COUNT);

    // ---- 生命周期 ----

    onLoad() {
        if (!this.graphics) {
            this.graphics = this.getComponent(Graphics);
        }
        if (!this.graphics) {
            console.warn('[FunctionWave] 未找到 Graphics 组件，请确保同节点上挂载了 Graphics');
            return;
        }

        // 预采样所有函数
        this.normalized = FUNCTIONS.map(f => sampleAndNormalize(f.fn));

        // 每次进入主界面重新洗牌播放序列，并随机起播点，
        // 避免玩家每次看到的都是同一条线 / 同一顺序（误以为是静态装饰）。
        this.order = this._shuffle(FUNCTIONS.length);
        this.currentIndex = Math.floor(Math.random() * this.order.length);

        // Graphics 线条圆角，曲线更平滑
        this.graphics.lineCap = 'round';
        this.graphics.lineJoin = 'round';
    }

    update(dt: number) {
        if (!this.graphics || this.normalized.length === 0) return;

        this.timer += dt;
        this._totalTime += dt;

        if (this.state === State.Hold) {
            if (this.timer >= this.holdDuration) {
                // 进入过渡
                this.state = State.Morph;
                this.timer = 0;
                this.fromIndex = this.currentIndex;
                this.currentIndex = (this.currentIndex + 1) % this.order.length;
                // 切换帧画旧函数，避免新函数闪现一帧
                this.draw(this.normalized[this._oi(this.fromIndex)]);
            } else {
                this.draw(this.normalized[this._oi(this.currentIndex)]);
            }
        } else {
            // Morph
            if (this.timer >= this.morphDuration) {
                // 过渡结束，切回 Hold，直接画目标函数
                this.state = State.Hold;
                this.timer = 0;
                this.draw(this.normalized[this._oi(this.currentIndex)]);
            } else {
                const t = Math.min(this.timer / this.morphDuration, 1);
                const eased = easeInOutCubic(t);
                this.lerpArrays(
                    this.normalized[this._oi(this.fromIndex)],
                    this.normalized[this._oi(this.currentIndex)],
                    eased,
                    this.morphBuffer,
                );
                this.draw(this.morphBuffer);
            }
        }

        this.updateLabelText();
    }

    // ---- 文本标签 ----

    /** 根据当前状态更新表达式标签（HOLD 固定显示，MORPH 淡入淡出） */
    private updateLabelText(): void {
        if (!this.label) return;

        if (this.state === State.Hold) {
            this.label.string = FUNCTIONS[this._oi(this.currentIndex)].display;
            this.setLabelAlpha(1);
        } else {
            const t = this.timer / this.morphDuration;
            if (t < this.labelFadePoint) {
                // 前半段：旧文本淡出
                this.label.string = FUNCTIONS[this._oi(this.fromIndex)].display;
                this.setLabelAlpha(1 - t / this.labelFadePoint);
            } else {
                // 后半段：新文本淡入
                this.label.string = FUNCTIONS[this._oi(this.currentIndex)].display;
                this.setLabelAlpha((t - this.labelFadePoint) / (1 - this.labelFadePoint));
            }
        }
    }

    /** 设置 Label 透明度（0~1），不影响其他通道 */
    private setLabelAlpha(a: number): void {
        if (!this.label) return;
        const c = this.label.color.clone();
        c.a = Math.round(Math.max(0, Math.min(1, a)) * 255);
        this.label.color = c;
    }

    // ---- 绘制 ----

    /** 画一帧：4 层叠加 */
    private draw(points: Float32Array): void {
        const g = this.graphics!;
        g.clear();

        // 层 1：Y 轴参考线（左侧竖线，12% 透明度）
        g.lineWidth = 1;
        g.strokeColor = this.alpha(COLOR, 0.12);
        g.moveTo(-HALF_WIDTH, -HALF_HEIGHT + 10);
        g.lineTo(-HALF_WIDTH, HALF_HEIGHT - 10);
        g.stroke();

        // 层 2：X 轴参考线（虚线，15% 透明度）
        g.lineWidth = 1;
        g.strokeColor = this.alpha(COLOR, 0.15);
        const dashLen = 6;
        const gapLen = 6;
        for (let x = -HALF_WIDTH; x < HALF_WIDTH; x += dashLen + gapLen) {
            g.moveTo(x, 0);
            g.lineTo(Math.min(x + dashLen, HALF_WIDTH), 0);
        }
        g.stroke();

        // 层 3：外层辉光（呼吸式：透明度 + 线宽随 sin(time) 缓动）
        if (this.enableBreathing) {
            const breathe = 0.5 + 0.5 * Math.sin(this._totalTime * (2 * Math.PI) / this.breathePeriod);
            const glowAlpha = this.glowAlphaMin + (this.glowAlphaMax - this.glowAlphaMin) * breathe;
            const glowWidth = this.glowWidthMin + (this.glowWidthMax - this.glowWidthMin) * breathe;

            g.lineWidth = glowWidth;
            g.strokeColor = this.alpha(COLOR, glowAlpha);
            this.strokeCurve(g, points);
        }

        // 层 4：主线（100% 透明度，2.5px 线宽）
        g.lineWidth = 2.5;
        g.strokeColor = this.alpha(COLOR, 1.0);
        this.strokeCurve(g, points);
    }

    /** 用点集画一条连续曲线 */
    private strokeCurve(g: Graphics, points: Float32Array): void {
        g.moveTo(this.xToPixel(0), this.yToPixel(points[0]));
        for (let i = 1; i < SAMPLE_COUNT; i++) {
            g.lineTo(this.xToPixel(i), this.yToPixel(points[i]));
        }
        g.stroke();
    }

    // ---- 工具 ----

    /** 采样索引 → 像素 x */
    private xToPixel(i: number): number {
        return -HALF_WIDTH + (2 * HALF_WIDTH) * i / (SAMPLE_COUNT - 1);
    }

    /** 归一化 y (-1~1) → 像素 y */
    private yToPixel(yNorm: number): number {
        return yNorm * AMPLITUDE;
    }

    /** 把"序列位置"解析成真实函数索引 */
    private _oi(pos: number): number {
        return this.order[pos];
    }

    /** Fisher-Yates 洗牌，返回 0..n-1 的随机排列（每次进入主界面重新洗牌） */
    private _shuffle(n: number): number[] {
        const a = Array.from({ length: n }, (_, i) => i);
        for (let i = n - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
        }
        return a;
    }

    /** 两个数组逐元素线性插值，结果写入 out */
    private lerpArrays(a: Float32Array, b: Float32Array, t: number, out: Float32Array): void {
        for (let i = 0; i < SAMPLE_COUNT; i++) {
            out[i] = a[i] + (b[i] - a[i]) * t;
        }
    }

    /** 复制一个 Color 并设置透明度（0~1） */
    private alpha(base: Color, a: number): Color {
        const c = base.clone();
        c.a = Math.round(a * 255);
        return c;
    }
}
