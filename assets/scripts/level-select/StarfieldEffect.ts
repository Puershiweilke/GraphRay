/**
 * StarfieldEffect.ts
 * 星空背景特效 —— 180 颗闪烁星点 + 浮动数学符号
 *
 * 职责：
 *   1. 用 Graphics.drawCircle 绘制随机分布星点，透明度正弦闪烁（dt 驱动）
 *   2. 用 Label 子节点显示数学符号，从底部缓慢上浮，顶部渐隐后重生
 *
 * 用法：
 *   挂载到场景 BackgroundLayer/StarfieldCanvas 节点上。
 *   该节点需带 Graphics 组件（或由脚本自动添加）和 UITransform 组件。
 *   星点坐标基于 UITransform 尺寸中心原点，锚点自适应。
 *
 * 参数：
 *   starCount / symbolCount 可在编辑器调节。
 */

import { _decorator, Component, Graphics, Color, Label, Node } from 'cc';

const { ccclass, property } = _decorator;

interface Star {
    x: number;          // 中心原点坐标（类似 Canvas canvasCoord）
    y: number;
    radius: number;
    baseAlpha: number;  // 基准透明度 0-1
    phase: number;      // 正弦相位，每帧 += speed * dt
    speed: number;      // 闪烁速度系数
}

interface MathSymbol {
    node: Node;
    label: Label;
    speed: number;      // 上浮速度 px/s
}

@ccclass('StarfieldEffect')
export class StarfieldEffect extends Component {

    @property({ tooltip: '星点数量' })
    starCount: number = 180;

    @property({ tooltip: '浮动数学符号数量' })
    symbolCount: number = 20;

    private _graphics: Graphics | null = null;
    private _stars: Star[] = [];
    private _symbols: MathSymbol[] = [];

    /** 绘制坐标范围（设计分辨率 1920×1080，中心原点） */
    private readonly W = 1920;
    private readonly H = 1080;
    private get _hw(): number { return this.W / 2; }
    private get _hh(): number { return this.H / 2; }

    private readonly SYMBOL_TEXTS = ['β', 'α', '∫', 'Σ', 'π', 'e', '∞', 'θ', 'Δ', '√'];

    // 复用 Color，避免每帧 new
    private readonly _starColor = new Color(255, 255, 255, 255);
    private readonly _symColor = new Color(158, 255, 0, 180);

    // ==================== 生命周期 ====================

    onLoad(): void {
        this._graphics = this.getComponent(Graphics) || this.addComponent(Graphics);
        this._initStars();
        this._initSymbols();
    }

    private _initStars(): void {
        this._stars.length = 0;
        const hw = this._hw;
        const hh = this._hh;
        for (let i = 0; i < this.starCount; i++) {
            this._stars.push({
                x: (Math.random() - 0.5) * hw * 2,   // [-hw, +hw]
                y: (Math.random() - 0.5) * hh * 2,   // [-hh, +hh]
                radius: Math.random() * 1.2 + 0.3,
                baseAlpha: Math.random() * 0.45 + 0.15,
                phase: Math.random() * Math.PI * 2,
                speed: Math.random() * 1.8 + 0.3,
            });
        }
    }

    private _initSymbols(): void {
        const hw = this._hw;
        const hh = this._hh;
        for (let i = 0; i < this.symbolCount; i++) {
            const node = new Node(`Symbol_${i}`);
            node.parent = this.node;
            node.layer = this.node.layer;

            const label = node.addComponent(Label);
            label.string = this.SYMBOL_TEXTS[i % this.SYMBOL_TEXTS.length];
            label.fontSize = Math.random() * 8 + 9;
            label.color = new Color(158, 255, 0, Math.floor(Math.random() * 140 + 50));

            // 中心原点随机分布，Y 范围 [-hh, +hh]（底部=负，顶部=正）
            node.setPosition(
                (Math.random() - 0.5) * hw * 2,
                (Math.random() - 0.5) * hh * 2,
            );

            this._symbols.push({
                node,
                label,
                speed: Math.random() * 14 + 6,
            });
        }
    }

    // ==================== 每帧更新 ====================

    update(dt: number): void {
        this._drawStars(dt);
        this._updateSymbols(dt);
    }

    // ---------- 星点：相位递增 → 正弦闪烁 ----------

    private _drawStars(dt: number): void {
        const g = this._graphics!;
        g.clear();

        for (const star of this._stars) {
            star.phase += star.speed * dt;

            // 透明度在 [baseAlpha - 0.3, baseAlpha + 0.3] 间摆动
            const alpha = star.baseAlpha + Math.sin(star.phase) * 0.3;
            const a = Math.max(0.05, Math.min(1, alpha));

            this._starColor.a = Math.floor(a * 255);
            g.fillColor = this._starColor;
            g.circle(star.x, star.y, star.radius);
            g.fill();
        }
    }

    // ---------- 数学符号：向上浮动，超出重置 ----------

    private _updateSymbols(dt: number): void {
        const hh = this._hh;

        for (const sym of this._symbols) {
            const pos = sym.node.position;
            let newY = pos.y + sym.speed * dt;

            // 超出顶部 → 重置到底部
            if (newY > hh + 30) {
                newY = -hh - 30;
                sym.node.setPosition(
                    (Math.random() - 0.5) * this._hw * 2,
                    newY,
                );
                sym.speed = Math.random() * 14 + 6;
            } else {
                sym.node.setPosition(pos.x, newY);
            }

            // 顶部 25% 区域渐隐
            const fadeStart = hh * 0.75;
            if (newY > fadeStart) {
                const t = (newY - fadeStart) / (hh * 0.25);
                const a = Math.floor(Math.max(0, 1 - t) * 180);
                this._symColor.a = a;
                sym.label.color = this._symColor;
            }
        }
    }

    onDestroy(): void {
        for (const sym of this._symbols) {
            if (sym.node?.isValid) {
                sym.node.destroy();
            }
        }
        this._symbols.length = 0;
    }
}
