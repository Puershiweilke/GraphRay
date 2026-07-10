/**
 * CardBackground.ts
 * 圆角矩形背景 —— Graphics 绘制，不依赖贴图。
 *
 * 支持：填充、描边、hover 态切换描边色、外发光层。
 */

import { _decorator, Component, Graphics, UITransform, Color } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('CardBackground')
export class CardBackground extends Component {

    @property({ tooltip: '填充色' })
    fillColor: Color = new Color(36, 36, 36);

    @property({ tooltip: '描边色（Alpha=0 则无描边）' })
    strokeColor: Color = new Color(61, 61, 61, 0);

    @property({ tooltip: '描边线宽（px）' })
    strokeWidth: number = 1;

    @property({ tooltip: '圆角半径（px）' })
    cornerRadius: number = 8;

    // ---- 外发光 ----
    @property({ tooltip: '外发光颜色' })
    glowColor: Color = new Color(158, 255, 0, 80);

    @property({ tooltip: '外发光扩散幅度（px），值越大光晕越远' })
    glowWidth: number = 36;

    private graphics: Graphics | null = null;
    private _origStroke: Color | null = null;
    private _glowing: boolean = false;

    onLoad() {
        this.graphics = this.getComponent(Graphics) || this.addComponent(Graphics);
        this._origStroke = this.strokeColor.clone();
        this.draw();
    }

    // ==================== 动态控制 ====================

    setStrokeColor(c: Color): void {
        this.strokeColor = c.clone();
        this.draw();
    }

    resetStrokeColor(): void {
        if (this._origStroke) {
            this.strokeColor = this._origStroke.clone();
            this.draw();
        }
    }

    showGlow(): void {
        this._glowing = true;
        this.draw();
    }

    hideGlow(): void {
        this._glowing = false;
        this.draw();
    }

    // ==================== 绘制 ====================

    draw(): void {
        const g = this.graphics!;
        const ui = this.node.getComponent(UITransform);
        if (!ui || ui.width <= 0 || ui.height <= 0) return;

        const w = ui.width;
        const h = ui.height;

        g.clear();

        // 外发光（多层同心描边模拟渐变衰减）
        if (this._glowing && this.glowColor.a > 0) {
            const glowAlpha = this.glowColor.a / 255; // 0~1
            // 从外到内 3 层：宽 / 淡 → 窄 / 浓
            const layers = [
                { width: this.glowWidth,       alpha: glowAlpha * 0.15 },
                { width: this.glowWidth * 0.6, alpha: glowAlpha * 0.35 },
                { width: this.glowWidth * 0.3, alpha: glowAlpha * 0.70 },
            ];
            for (const l of layers) {
                const c = this.glowColor.clone();
                c.a = Math.round(l.alpha * 255);
                g.strokeColor = c;
                g.lineWidth   = l.width;
                g.roundRect(-w / 2, -h / 2, w, h, this.cornerRadius);
                g.stroke();
            }
        }

        // 填充
        if (this.fillColor.a > 0) {
            g.fillColor = this.fillColor;
            g.roundRect(-w / 2, -h / 2, w, h, this.cornerRadius);
            g.fill();
        }

        // 描边
        if (this.strokeColor.a > 0 && this.strokeWidth > 0) {
            g.strokeColor = this.strokeColor;
            g.lineWidth   = this.strokeWidth;
            g.roundRect(-w / 2, -h / 2, w, h, this.cornerRadius);
            g.stroke();
        }
    }
}
