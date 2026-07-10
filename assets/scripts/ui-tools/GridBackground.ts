/**
 * GridBackground.ts
 * 网格底纹 + 音频包络驱动线条粗细
 *
 * 加载 envelope.json（onset_strength 降采样包络），
 * 每帧根据 AudioManager.instance.currentTime 线性插值包络值，
 * 用包络值驱定网格线条粗细——节拍时线变粗，安静时恢复。
 * 比调透明度对眼睛友好得多。
 *
 * 用法：挂到带 Graphics 的节点上即可，音频由 AudioManager 统一管理。
 */

import { _decorator, Component, Graphics, Color, UITransform, resources, JsonAsset } from 'cc';
import { AudioManager } from '../core/AudioManager';

const { ccclass, property } = _decorator;

const SIGNAL = new Color(158, 255, 0);

interface EnvelopeData {
    duration: number;
    envelope_hz: number;
    envelope: number[];
}

@ccclass('GridBackground')
export class GridBackground extends Component {

    // ---- 静态网格 ----

    @property({ tooltip: '小格间距（px）' })
    minorSpacing: number = 80;

    @property({ tooltip: '大格间距（px，通常为小格的整数倍）' })
    majorSpacing: number = 240;

    @property({ tooltip: '小格线透明度（固定，不受节拍影响）' })
    minorAlpha: number = 0.10;

    @property({ tooltip: '大格线透明度（固定，不受节拍影响）' })
    majorAlpha: number = 0.16;

    // ---- 包络驱动（控制粗细） ----

    @property({ tooltip: '启用音频包络同步' })
    enableBeatSync: boolean = true;

    @property({ tooltip: '线条基础粗细（px）' })
    baseThickness: number = 1;

    @property({ tooltip: '节拍时最大加粗量（px）' })
    thickBoost: number = 3;

    @property({ tooltip: '包络曲线指数（>1 拉开强弱差距）' })
    envelopeCurve: number = 1.2;

    @property({ tooltip: '起音速度（0~1），越大越跟手' })
    attackFactor: number = 0.8;

    @property({ tooltip: '释音速度（0~1），越大回落越快。0.3=节拍间隙能回到底' })
    releaseFactor: number = 0.3;

    @property({ tooltip: '大格线粗细乘数' })
    majorThickMul: number = 1.0;

    @property({ tooltip: '小格线粗细乘数' })
    minorThickMul: number = 0.35;

    @property({ type: Graphics, tooltip: 'Graphics 组件（自动获取）' })
    graphics: Graphics | null = null;

    // ---- 私有 ----

    private _envelope: number[] = [];
    private _envHz: number = 30;
    private _loaded: boolean = false;

    private _smoothedEnv: number = 0;
    private _currentMinorW: number = 1;
    private _currentMajorW: number = 1;
    private _lastMinorW: number = -1;

    private _left: number = 0;
    private _right: number = 0;
    private _top: number = 0;
    private _bottom: number = 0;
    private _minorStartX: number = 0;
    private _minorStartY: number = 0;
    private _majorStartX: number = 0;
    private _majorStartY: number = 0;

    // ---- 生命周期 ----

    onLoad(): void {
        if (!this.graphics) this.graphics = this.getComponent(Graphics);
        if (!this.graphics) { console.warn('[GridBackground] 未找到 Graphics'); return; }

        this._cacheGeometry();

        if (this.enableBeatSync) {
            this._loadEnvelope();
        } else {
            this._draw();
        }
    }

    update(_dt: number): void {
        if (!this._loaded || !this.graphics) return;

        const rawEnv = this._sampleEnvelope(AudioManager.instance.currentTime);
        const target = Math.pow(rawEnv, this.envelopeCurve);

        const factor = target > this._smoothedEnv ? this.attackFactor : this.releaseFactor;
        this._smoothedEnv += (target - this._smoothedEnv) * factor;

        this._currentMinorW = this.baseThickness + this._smoothedEnv * this.thickBoost * this.minorThickMul;
        this._currentMajorW = this.baseThickness + this._smoothedEnv * this.thickBoost * this.majorThickMul;

        if (Math.abs(this._currentMinorW - this._lastMinorW) < 0.05) return;
        this._lastMinorW = this._currentMinorW;

        this._draw();
    }

    // ---- 加载 ----

    private _loadEnvelope(): void {
        resources.load('envelope', JsonAsset, (err, asset) => {
            if (err) {
                console.warn('[GridBackground] 未找到 envelope.json，回退静态模式');
                this._draw();
                return;
            }
            const data = asset.json as EnvelopeData;
            this._envelope = data.envelope || [];
            this._envHz = data.envelope_hz || 30;
            this._loaded = true;
            console.log(`[GridBackground] 包络加载完成: ${this._envelope.length} 点 @ ${this._envHz}Hz`);
            this._draw();
        });
    }

    private _sampleEnvelope(t: number): number {
        const env = this._envelope;
        if (!env.length) return 0;
        const rawIdx = t * this._envHz;
        const i0 = Math.floor(rawIdx);
        const i1 = i0 + 1;
        if (i1 >= env.length || i0 < 0) return 0;
        const frac = rawIdx - i0;
        return env[i0] + (env[i1] - env[i0]) * frac;
    }

    // ---- 几何缓存 ----

    private _cacheGeometry(): void {
        const ui = this.node.getComponent(UITransform);
        const w = ui?.width ?? 1080;
        const h = ui?.height ?? 1920;
        this._left = -w / 2;
        this._right = w / 2;
        this._top = h / 2;
        this._bottom = -h / 2;
        this._minorStartX = Math.ceil(this._left / this.minorSpacing) * this.minorSpacing;
        this._minorStartY = Math.ceil(this._bottom / this.minorSpacing) * this.minorSpacing;
        this._majorStartX = Math.ceil(this._left / this.majorSpacing) * this.majorSpacing;
        this._majorStartY = Math.ceil(this._bottom / this.majorSpacing) * this.majorSpacing;
    }

    // ---- 绘制 ----

    private _draw(): void {
        const g = this.graphics!;
        g.clear();

        const L = this._left;
        const R = this._right;
        const T = this._top;
        const B = this._bottom;

        // 小格线
        const mw = this._currentMinorW;
        const mhw = mw / 2;
        g.fillColor = this.alpha(SIGNAL, this.minorAlpha);
        for (let x = this._minorStartX; x <= R; x += this.minorSpacing) g.rect(x - mhw, B, mw, T - B);
        for (let y = this._minorStartY; y <= T; y += this.minorSpacing) g.rect(L, y - mhw, R - L, mw);
        g.fill();

        // 大格线
        const Mw = this._currentMajorW;
        const Mhw = Mw / 2;
        g.fillColor = this.alpha(SIGNAL, this.majorAlpha);
        for (let x = this._majorStartX; x <= R; x += this.majorSpacing) g.rect(x - Mhw, B, Mw, T - B);
        for (let y = this._majorStartY; y <= T; y += this.majorSpacing) g.rect(L, y - Mhw, R - L, Mw);
        g.fill();
    }

    private alpha(base: Color, a: number): Color {
        const c = base.clone();
        c.a = Math.round(Math.max(0, Math.min(1, a)) * 255);
        return c;
    }
}
