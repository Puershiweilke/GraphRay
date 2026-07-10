/**
 * LevelNode.ts — 关卡节点组件（六边形终端风格）
 *
 * 职责：4 种状态的视觉渲染 + 常驻悬浮动画。
 *
 * 节点外形：flat-top 六边形（顶点朝天），模拟卫星数据终端芯片。
 * 辉光与选中环保持圆形，形成"方芯圆晕"的几何对比。
 *
 * 状态视觉规范（requirements.md §3.3）：
 *   complete:      绿色实心 + 黑色编号 + 呼吸辉光 2.5s
 *   challengeable: 暗底 + 1.5px 绿边框 + 绿色编号 + 脉冲辉光 1.6s
 *   unlocked:      暗底 + 1px 灰边框 + 浅灰编号（保持可见）
 *   locked:        灰底 + 1px 弱边框 + 弱灰编号（保留存在感，不消失）
 *   selected:      叠加 3px 绿外环 + 扩散辉光 ping-pong 2s
 *
 * 尺寸：UITransform 固定；视觉半径按状态微调（complete 最大）。
 */

import { _decorator, Component, Graphics, Color, Label, Node, UITransform } from 'cc';
import { FontManager } from '../core/FontManager';

const { ccclass, property } = _decorator;

export enum LevelStatus {
    COMPLETE = 'complete',
    CHALLENGEABLE = 'challengeable',
    LOCKED = 'locked',
}

// 色彩
const C_SIGNAL = new Color(158, 255, 0);      // #9EFF00 — 绿（已激活）
const C_AMBER  = new Color(239, 159, 39);     // #EF9F27 — 琥珀（待激活）
const C_COMPLETE_FILL = new Color(26, 58, 20); // #1A3A14 — 暗绿底色（complete 填充）
const C_CARD_BG = new Color(36, 36, 36);       // #242424 — challengeable 底色
const C_LOCKED_BG = new Color(45, 45, 45);     // #2D2D2D — locked 底色
const C_LOCKED_TEXT = new Color(100, 100, 100); // #646464
const C_DARK_BORDER = new Color(60, 60, 60);   // #3C3C3C — locked 边框
const C_BLACK = new Color(0, 0, 0);

/** 各状态视觉半径比例（相对 nodeSize/2=24px） */
const RADIUS_SCALE: Record<LevelStatus, number> = {
    [LevelStatus.COMPLETE]:      1.00,
    [LevelStatus.CHALLENGEABLE]: 0.94,
    [LevelStatus.LOCKED]:        0.82,
};

@ccclass('LevelNode')
export class LevelNode extends Component {

    get levelIndex(): number { return this._levelIndex; }
    set levelIndex(v: number) {
        this._levelIndex = v;
        if (this._label) this._label.string = String(v);
    }

    @property
    selected: boolean = false;

    get status(): LevelStatus { return this._status; }
    set status(v: LevelStatus) { this._status = v; }

    // ---------- 私有 ----------

    private _status: LevelStatus = LevelStatus.LOCKED;
    private _levelIndex: number = 1;
    private _time: number = 0;
    private _graphics: Graphics | null = null;
    private _label: Label | null = null;
    private _nodeSize: number = 56;

    // ==================== 过渡控制 ====================

    /**
     * 过渡透明度（0=全透明, 255=不透明），供 ChapterTransition tween 驱动。
     * 作用于 Graphics fill/stroke 和 Label 颜色的 alpha，不依赖 UIOpacity。
     */
    transitionAlpha: number = 255;

    private readonly _glowC = new Color(158, 255, 0, 0);
    private readonly _glowAmberC = new Color(239, 159, 39, 0);
    private readonly _tmpC = new Color();   // Graphics 颜色复用
    private readonly _tmpLabel = new Color(); // Label 颜色复用

    // ==================== 悬浮动画 ====================

    @property({ tooltip: '悬浮幅度（px），±此值在轨道位置上微颤，模拟卫星轨道微调' })
    floatAmplitude: number = 2;

    @property({ tooltip: '悬浮周期（秒），一个完整浮动的时长' })
    floatPeriod: number = 3.5;

    private _baseX: number = 0;         // 初始轨道 X（在 start 里捕获）
    private _baseY: number = 0;
    private _floatPhase: number = 0;    // 随机相位（去同步化）
    private _floatInited: boolean = false;

    onLoad(): void {
        this._graphics = this.getComponent(Graphics) || this.addComponent(Graphics);
        const ut = this.getComponent(UITransform);
        if (ut && ut.width > 0) this._nodeSize = ut.width;

        // Label
        this._label = this.node.getChildByName('Label')?.getComponent(Label) ?? null;
        if (!this._label) {
            const ln = new Node('Label');
            ln.parent = this.node;
            ln.layer = this.node.layer;
            this._label = ln.addComponent(Label);
        }
        this._label.string = String(this._levelIndex);
        FontManager.attach(this._label);  // 统一 Orbitron（数字，直接引用资源，不依赖系统字体）
        this._label.fontSize = 20;
        this._label.horizontalAlign = Label.HorizontalAlign.CENTER;
        this._label.verticalAlign = Label.VerticalAlign.CENTER;
        // 自适应：双位数（如 12）在窄框里也不裁切；并略加宽留白
        this._label.overflow = Label.Overflow.SHRINK;
        this._label.enableWrap = false;
        const lu = this._label.node.getComponent(UITransform);
        if (lu) lu.setContentSize(this._nodeSize + 10, this._nodeSize + 10);
        // Label 是节点唯一子节点，渲染顺序在本节点的 Graphics 之后 → 数字始终在六边形之上
    }

    update(dt: number): void {
        this._time += dt;
        this._draw();
        this._applyFloat();
    }

    // ==================== 悬浮 ====================

    /** 首次调用时捕获轨道基准位置 + 随机相位 */
    private _initFloat(): void {
        this._baseX = this.node.position.x;
        this._baseY = this.node.position.y;
        this._floatPhase = Math.random() * Math.PI * 2;
        this._floatInited = true;
    }

    /**
     * 在基准位置上叠加 Lissajous 式微偏移（±floatAmplitude px），
     * X/Y 用不同相位制造椭圆状浮动，避免单调的直线往复。
     */
    private _applyFloat(): void {
        if (!this._floatInited) this._initFloat();
        const w = (2 * Math.PI) / this.floatPeriod;
        const angle = this._time * w + this._floatPhase;
        const ox = Math.sin(angle) * this.floatAmplitude;
        const oy = Math.cos(angle + 0.8) * this.floatAmplitude * 0.65;
        this.node.setPosition(this._baseX + ox, this._baseY + oy, 0);
    }

    // ==================== 绘制 ====================

    /** 六边形路径（顶点朝天，flat-top 终端风格） */
    private _drawHexagon(g: Graphics, r: number): void {
        const n = 6;
        const offset = -Math.PI / 2; // 起点朝上
        g.moveTo(r * Math.cos(offset), r * Math.sin(offset));
        for (let i = 1; i < n; i++) {
            const a = Math.PI / 3 * i + offset;
            g.lineTo(r * Math.cos(a), r * Math.sin(a));
        }
        g.close();
    }

    private _draw(): void {
        const g = this._graphics!;
        const baseR = this._nodeSize / 2;
        const r = baseR * RADIUS_SCALE[this._status];
        const ta = this.transitionAlpha / 255;
        g.clear();

        switch (this._status) {
            case LevelStatus.COMPLETE:
                // 暗绿填充
                this._tmpC.set(C_COMPLETE_FILL);
                this._tmpC.a = Math.floor(this._tmpC.a * ta);
                g.fillColor = this._tmpC;
                this._drawHexagon(g, r);
                g.fill();
                // 外层半透明防锯齿
                this._tmpC.set(C_SIGNAL); this._tmpC.a = Math.floor(76 * ta);
                g.strokeColor = this._tmpC; g.lineWidth = 3.5;
                this._drawHexagon(g, r); g.stroke();
                // 内层实色主描边
                this._tmpC.set(C_SIGNAL); this._tmpC.a = Math.floor(this._tmpC.a * ta);
                g.strokeColor = this._tmpC; g.lineWidth = 2;
                this._drawHexagon(g, r); g.stroke();
                this._drawGlow(g, r, 2.5, 0.12, 0.30);
                break;

            case LevelStatus.CHALLENGEABLE:
                this._tmpC.set(C_CARD_BG);
                this._tmpC.a = Math.floor(this._tmpC.a * ta);
                g.fillColor = this._tmpC;
                this._drawHexagon(g, r); g.fill();
                // AA
                this._tmpC.set(C_AMBER); this._tmpC.a = Math.floor(76 * ta);
                g.strokeColor = this._tmpC; g.lineWidth = 3.5;
                this._drawHexagon(g, r); g.stroke();
                // 主描边
                this._tmpC.set(C_AMBER); this._tmpC.a = Math.floor(this._tmpC.a * ta);
                g.strokeColor = this._tmpC; g.lineWidth = 2;
                this._drawHexagon(g, r); g.stroke();
                this._drawGlow(g, r, 1.2, 0.15, 0.40, this._glowAmberC);
                break;

            case LevelStatus.LOCKED:
                this._tmpC.set(C_LOCKED_BG);
                this._tmpC.a = Math.floor(this._tmpC.a * ta);
                g.fillColor = this._tmpC;
                this._drawHexagon(g, r); g.fill();
                // AA
                this._tmpC.set(C_DARK_BORDER); this._tmpC.a = Math.floor(51 * ta);
                g.strokeColor = this._tmpC; g.lineWidth = 4;
                this._drawHexagon(g, r); g.stroke();
                // 主描边
                this._tmpC.set(C_DARK_BORDER); this._tmpC.a = Math.floor(this._tmpC.a * ta);
                g.strokeColor = this._tmpC; g.lineWidth = 2.5;
                this._drawHexagon(g, r); g.stroke();
                break;
        }

        // --- 选中叠加（辉光也受 ta 约束） ---
        if (this.selected) {
            const selT = (this._time / 2.0) * Math.PI * 2;
            const selAlpha = 0.55 + Math.sin(selT) * 0.45;

            this._glowC.a = Math.floor(selAlpha * this.transitionAlpha);
            g.strokeColor = this._glowC;
            g.lineWidth = 4;
            g.circle(0, 0, r + 4);
            g.stroke();

            this._glowC.a = Math.floor(selAlpha * 0.30 * this.transitionAlpha);
            g.strokeColor = this._glowC;
            g.lineWidth = 3;
            g.circle(0, 0, r + 10);
            g.stroke();
        }

        // --- Label ---
        if (this._label) {
            switch (this._status) {
                case LevelStatus.COMPLETE:      this._tmpLabel.set(C_SIGNAL); break;
                case LevelStatus.CHALLENGEABLE: this._tmpLabel.set(C_AMBER); break;
                case LevelStatus.LOCKED:        this._tmpLabel.set(C_LOCKED_TEXT); break;
            }
            this._tmpLabel.a = Math.floor(this._tmpLabel.a * ta);
            this._label.color = this._tmpLabel;
        }
    }

    /**
     * 3 层同心辉光：内粗 → 外稀薄，模拟发光晕。
     * @param baseColor 辉光颜色，默认信号绿
     */
    private _drawGlow(g: Graphics, r: number, period: number,
        minAlpha: number, maxAlpha: number, baseColor?: Color): void {
        const c = baseColor ?? this._glowC;
        const t = (this._time / period) * Math.PI * 2;
        const a = minAlpha + (Math.sin(t) * 0.5 + 0.5) * (maxAlpha - minAlpha);

        c.a = Math.floor(a * this.transitionAlpha);
        g.strokeColor = c;
        g.lineWidth = 6;
        g.circle(0, 0, r + 3);
        g.stroke();

        c.a = Math.floor(a * 0.45 * this.transitionAlpha);
        g.strokeColor = c;
        g.lineWidth = 4;
        g.circle(0, 0, r + 9);
        g.stroke();

        c.a = Math.floor(a * 0.18 * this.transitionAlpha);
        g.strokeColor = c;
        g.lineWidth = 2;
        g.circle(0, 0, r + 16);
        g.stroke();
    }

    /**
     * 中心状态指示点（模拟终端连接灯）
     */
    private _drawDot(g: Graphics, r: number, color: Color, ta: number): void {
        this._tmpC.set(color);
        this._tmpC.a = Math.floor(this._tmpC.a * ta);
        g.fillColor = this._tmpC;
        g.circle(0, 0, Math.max(2.5, r * 0.18));
        g.fill();
    }
}
