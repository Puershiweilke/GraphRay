/**
 * ScanSweep.ts — 章节切换扫描线
 *
 * 一条绿色扫描线从上到下横扫 OrbitZone。
 * sweep() 返回 Promise：淡入→移动→淡出，完成后自动隐藏。
 *
 * 用法：挂到 OrbitZone/ScanSweep 节点（需 Graphics 组件）。
 */

import { _decorator, Component, Graphics, Color, tween, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('ScanSweep')
export class ScanSweep extends Component {

    @property({ tooltip: '扫描线颜色' })
    color: Color = new Color(158, 255, 0, 180);

    @property({ tooltip: '扫描线高度 (px)' })
    lineH: number = 4;

    @property({ tooltip: '辉光扩散高度 (px)' })
    glowH: number = 16;

    @property({ tooltip: '扫描区域高度 (px)，默认 OrbitZone = 720' })
    zoneH: number = 720;

    @property({ tooltip: '扫描时长 (s)' })
    duration: number = 0.45;

    @property({ tooltip: '淡入/淡出时长 (s)' })
    fadeDuration: number = 0.1;

    /**
     * 过渡透明度（0=全透明, 255=不透明），供 tween 驱动。
     * 作用于 _drawLine 中 fillColor 的 alpha。
     */
    transitionAlpha: number = 0;

    /**
     * 扫描线每帧局部 Y 坐标回调（扫描期间持续上报，从顶 +zoneH/2 落到底 -zoneH/2）。
     * 供外部配合过渡节奏（如让章名在「扫描线落下来」时才淡出）。
     */
    onScanY: ((y: number) => void) | null = null;

    private _g: Graphics | null = null;

    onLoad(): void {
        this._g = this.getComponent(Graphics) || this.addComponent(Graphics);
        this.node.active = false;
    }

    /** 执行一次扫描：淡入 → 移动 → 淡出 → 隐藏 */
    sweep(): Promise<void> {
        return new Promise(async resolve => {
            const g = this._g!;
            const startY = this.zoneH / 2;
            const endY = -this.zoneH / 2;

            // 初始状态：顶部、不可见
            this.node.setPosition(0, startY, 0);
            this.transitionAlpha = 0;
            this.node.active = true;

            // 开始逐帧绘制
            this.schedule(this._drawLine, 0);

            // Phase 1: 淡入
            await new Promise<void>(r => {
                tween(this)
                    .to(this.fadeDuration, { transitionAlpha: 255 })
                    .call(() => r())
                    .start();
            });

            // Phase 2: 向下扫描（每帧回报当前 Y，供外部配合过渡节奏，如标题淡出）
            await new Promise<void>(r => {
                const report = () => { if (this.onScanY) this.onScanY(this.node.position.y); };
                this.schedule(report, 0);
                tween(this.node)
                    .to(this.duration, { position: new Vec3(0, endY, 0) })
                    .call(() => { this.unschedule(report); r(); })
                    .start();
            });

            // Phase 3: 淡出
            await new Promise<void>(r => {
                tween(this)
                    .to(this.fadeDuration, { transitionAlpha: 0 })
                    .call(() => r())
                    .start();
            });

            // 收尾
            this.unschedule(this._drawLine);
            this.node.active = false;
            resolve();
        });
    }

    private _drawLine(): void {
        const g = this._g!;
        g.clear();

        const ta = this.transitionAlpha / 255;
        const hw = 960;

        // 辉光层
        g.fillColor = new Color(this.color.r, this.color.g, this.color.b, Math.floor(30 * ta));
        g.rect(-hw, -this.glowH / 2, hw * 2, this.glowH);
        g.fill();

        // 主线
        g.fillColor = new Color(this.color.r, this.color.g, this.color.b, Math.floor(180 * ta));
        g.rect(-hw, -this.lineH / 2, hw * 2, this.lineH);
        g.fill();
    }
}
