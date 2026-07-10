/**
 * OrbitRings.ts
 * 4 条椭圆轨道环 —— 各自由呼吸辉光
 *
 * 坐标体系：OrbitZone 坐标（1920×720），toLocal 转为中心原点。
 * 所有轨道椭圆中心对齐 layout.json 的 corePosition（默认 OrbitZone 正中心）。
 *
 * 用法：
 *   挂到 OrbitZone/OrbitRings 节点上，节点需带 Graphics 组件。
 *   OrbitRings 节点的 position 应为 (0, 0)，内容由 Graphics 直接绘制。
 */

import { _decorator, Component, Graphics, Color } from 'cc';

const { ccclass, property } = _decorator;

/** OrbitZone 尺寸 */
const ZONE_W = 1920;
const ZONE_H = 720;
const HW = ZONE_W / 2;  // 960
const HH = ZONE_H / 2;  // 360

/** OrbitZone 坐标 → 中心原点坐标 */
function toLocal(zx: number, zy: number): { x: number; y: number } {
    return { x: zx - HW, y: zy - HH };
}

interface Ring {
    cx_z: number;       // 椭圆中心 X（OrbitZone 坐标）
    cy_z: number;       // 椭圆中心 Y（OrbitZone 坐标）
    rx: number;
    ry: number;
    baseOpacity: number;
    period: number;     // 呼吸周期（秒）
    phase: number;
}

@ccclass('OrbitRings')
export class OrbitRings extends Component {

    @property({ tooltip: '辉光线宽（px）' })
    lineWidth: number = 1.5;

    @property({ tooltip: '辉光扩散量（px）' })
    glowSpread: number = 3;

    private _graphics: Graphics | null = null;
    private _time: number = 0;

    /**
     * 3 条轨道。节点落在中间环（ring 2: rx=580）上，形成"外框→任务轨→内环"三层结构。
     */
    private readonly _rings: Ring[] = [
        { cx_z: 960, cy_z: 360, rx: 780, ry: 250, baseOpacity: 0.09, period: 5.0,  phase: 0   },
        { cx_z: 960, cy_z: 360, rx: 580, ry: 170, baseOpacity: 0.16, period: 4.0,  phase: 1.5 },
        { cx_z: 960, cy_z: 360, rx: 380, ry: 110, baseOpacity: 0.12, period: 3.0,  phase: 3.0 },
    ];

    onLoad(): void {
        this._graphics = this.getComponent(Graphics) || this.addComponent(Graphics);
    }

    update(dt: number): void {
        this._time += dt;
        const g = this._graphics!;
        g.clear();

        for (const ring of this._rings) {
            const t = (this._time / ring.period + ring.phase) * Math.PI * 2;
            const opacity = ring.baseOpacity + Math.sin(t) * 0.04;
            const { x, y } = toLocal(ring.cx_z, ring.cy_z);

            // 辉光层
            g.strokeColor = new Color(158, 255, 0, Math.floor(opacity * 255 * 0.6));
            g.lineWidth = this.lineWidth + this.glowSpread;
            g.ellipse(x, y, ring.rx, ring.ry);
            g.stroke();

            // 主线层
            g.strokeColor = new Color(158, 255, 0, Math.floor(opacity * 255 * 0.35));
            g.lineWidth = this.lineWidth;
            g.ellipse(x, y, ring.rx, ring.ry);
            g.stroke();
        }
    }
}
