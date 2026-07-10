/**
 * OrbitParticles.ts — 轨道数据流粒子
 *
 * 30 个绿色光点沿 3 条椭圆轨道流动，模拟"数据包在光纤中奔涌"。
 *
 * 用法：挂到 OrbitZone/OrbitParticles 节点（需 Graphics 组件）。
 *
 * 数据驱动：粒子总数、光点半径、速度范围、轨道参数均可在编辑器调整。
 */

import { _decorator, Component, Graphics, Color } from 'cc';

const { ccclass, property } = _decorator;

interface Particle {
    orbit: number;    // 轨道索引 0-2
    angle: number;    // 当前角度（弧度）
    speed: number;    // 角速度（弧度/秒）
    alpha: number;    // 目标透明度
    currentAlpha: number;
}

@ccclass('OrbitParticles')
export class OrbitParticles extends Component {

    // ==================== 参数 ====================

    @property({ tooltip: '粒子总数' })
    count: number = 30;

    @property({ tooltip: '光点半径 (px)' })
    dotRadius: number = 2.5;

    @property({ tooltip: '最小角速度 (rad/s)' })
    speedMin: number = 0.3;

    @property({ tooltip: '最大角速度 (rad/s)' })
    speedMax: number = 1.2;

    @property({ tooltip: '透明度范围下限' })
    alphaMin: number = 0.3;

    @property({ tooltip: '透明度范围上限' })
    alphaMax: number = 0.9;

    // ==================== 轨道参数（与 OrbitRings 对齐） ====================

    /** 3 条轨道的椭圆半轴 (rx, ry) */
    private readonly _orbits: Array<{ rx: number; ry: number }> = [
        { rx: 780, ry: 250 },  // 外环
        { rx: 580, ry: 170 },  // 中环（节点轨）
        { rx: 380, ry: 110 },  // 内环
    ];

    // ==================== 运行时 ====================

    /** 过渡透明度（0=全透明, 255=不透明），供 ChapterTransition tween 驱动 */
    transitionAlpha: number = 255;

    private _graphics: Graphics | null = null;
    private _particles: Particle[] = [];
    private readonly _color = new Color(158, 255, 0, 200);

    onLoad(): void {
        this._graphics = this.getComponent(Graphics) || this.addComponent(Graphics);
        this._spawn();
    }

    update(dt: number): void {
        this._updateParticles(dt);
        this._draw();
    }

    // ==================== 粒子管理 ====================

    private _spawn(): void {
        this._particles.length = 0;
        // 按轨道长度比例分配粒子：外环 > 中环 > 内环
        const perRing = [12, 11, 7]; // 30 个
        for (let o = 0; o < 3; o++) {
            for (let j = 0; j < perRing[o]; j++) {
                this._particles.push({
                    orbit: o,
                    angle: Math.random() * Math.PI * 2,
                    speed: this.speedMin + Math.random() * (this.speedMax - this.speedMin) * (1 - o * 0.2),
                    alpha: this.alphaMin + Math.random() * (this.alphaMax - this.alphaMin),
                    currentAlpha: 0,
                });
            }
        }
    }

    private _updateParticles(dt: number): void {
        for (const p of this._particles) {
            p.angle += p.speed * dt;
            if (p.angle > Math.PI * 2) p.angle -= Math.PI * 2;
            // 透明度平滑过渡
            p.currentAlpha += (p.alpha - p.currentAlpha) * dt * 4;
        }
    }

    // ==================== 绘制 ====================

    /** 重置并重生所有粒子 */
    respawn(): void {
        this._spawn();
    }

    private _draw(): void {
        const g = this._graphics!;
        g.clear();
        const ta = this.transitionAlpha;

        for (const p of this._particles) {
            const { rx, ry } = this._orbits[p.orbit];
            const x = rx * Math.cos(p.angle);
            const y = ry * Math.sin(p.angle);
            const a = Math.floor(p.currentAlpha * ta);

            this._color.a = a;
            g.fillColor = this._color;
            g.circle(x, y, this.dotRadius);
            g.fill();
        }
    }
}
