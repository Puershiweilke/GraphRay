/**
 * ChapterTitle.ts — 章节主副标题（第 X 章 / 章名）
 *
 * 设计（用户确立 · 2026-07-09 从 LevelSelectBootstrap 抽出为独立组件）：
 *   - 主标题 = 「第 X 章」（结构锚点，短而稳定，信号绿 #9EFF00）。
 *   - 副标题 = 章名（来自 chapters.json，可能较长，灰白、可换行）。
 *   - 上下两行（同 x=0，主在上副在下）；与章节圆点导航(ChapterDots)分离关注点。
 *   - 落位由 Bootstrap 负责（挂到 OrbitZone、局部 y 取负值落在轨道与 dots 之间）；
 *     本组件只管自身内部布局（字号/颜色/间距），均为 @property 数据驱动、Inspector 可实时调。
 *   - 接法（与 ChapterDots 同范式，不依赖 onLoad 时序）：
 *       Bootstrap 建节点 → addComponent(ChapterTitle) → setTitle(index, name)。
 *       标签子节点在首次 setTitle 时按需创建（build-once），之后仅更新文字。
 */

import { _decorator, Component, Node, Label, Color, UITransform, UIOpacity, tween, Tween } from 'cc';
import { FontManager } from '../core/FontManager';

const { ccclass, property } = _decorator;

@ccclass('ChapterTitle')
export class ChapterTitle extends Component {

    @property({ tooltip: '主标题字号（第 X 章）' })
    mainFontSize: number = 30;

    @property({ tooltip: '副标题字号（章名）' })
    subFontSize: number = 20;

    @property({ tooltip: '主副标题竖向间距（px，两行中心距）' })
    gap: number = 56;

    @property({ tooltip: '主标题色（默认信号绿 #9EFF00）' })
    mainColor: Color = new Color(158, 255, 0);

    @property({ tooltip: '副标题色（灰白）' })
    subColor: Color = new Color(214, 222, 214);

    @property({ tooltip: '切章时标题淡出时长（秒）' })
    fadeOutDur: number = 0.25;

    @property({ tooltip: '切章时标题淡入时长（秒）' })
    fadeInDur: number = 0.35;

    private _main: Label | null = null;
    private _sub: Label | null = null;
    private _op: UIOpacity | null = null;   // 整组（主+副）淡入淡出
    private _tween: Tween | null = null;     // 进行中的过渡（切章重入时 stop 旧）
    private _built: boolean = false;

    /** 立即设置（首次 / 预设，无淡入）。 */
    setTitle(index: number, name: string): void {
        if (!this._built) this._build();
        this._setText(index, name);
    }

    /**
     * 独立过渡（不依赖扫描线，备用）：淡出当前 → 换字 → 淡入一气呵成。
     * 切章主路径已改用 syncFadeOut / syncFadeIn 配合扫描节奏；此方法保留供非扫描场景（如预设进度跳变）复用。
     */
    fadeTo(index: number, name: string): void {
        if (!this._built) this._build();
        if (!this._op) { this._setText(index, name); return; }
        if (this._tween) this._tween.stop();
        this._op.opacity = 255;
        this._tween = tween(this._op)
            .to(this.fadeOutDur, { opacity: 0 })
            .call(() => { this._setText(index, name); if (this._op) this._op.opacity = 0; })
            .to(this.fadeInDur, { opacity: 255 })
            .start();
    }

    private _setText(index: number, name: string): void {
        if (this._main) this._main.string = `第 ${index + 1} 章`;
        if (this._sub) this._sub.string = name ?? '';
    }

    /**
     * 配合扫描节奏（由 Bootstrap 在扫描线落到标题位置时调用）：
     * 淡出当前 → 换字，opacity 留在 0，不自行淡入。
     */
    syncFadeOut(index: number, name: string, dur: number = this.fadeOutDur): void {
        if (!this._built) this._build();
        if (!this._op) { this._setText(index, name); return; }
        if (this._tween) this._tween.stop();
        this._op.opacity = 255;
        this._tween = tween(this._op)
            .to(dur, { opacity: 0 })
            .call(() => { this._setText(index, name); if (this._op) this._op.opacity = 0; })
            .start();
    }

    /** 配合扫描节奏（由 Bootstrap 在 bootup 数据就位后调用）：从 0 淡入到 255 */
    syncFadeIn(dur: number = this.fadeInDur): void {
        if (!this._op) return;
        if (this._tween) this._tween.stop();
        this._op.opacity = 0;
        this._tween = tween(this._op).to(dur, { opacity: 255 }).start();
    }

    /**
     * 仅淡出、不换字（用于「进入关卡」整屏退出：配合扫描线把章名淡掉，但保留当前文字，
     * 因为本场景即将被销毁，无需切换到新章名）。
     */
    fadeOutOnly(dur: number = this.fadeOutDur): void {
        if (!this._built) this._build();
        if (!this._op) return;
        if (this._tween) this._tween.stop();
        this._op.opacity = 255;
        this._tween = tween(this._op).to(dur, { opacity: 0 }).start();
    }

    private _build(): void {
        this.node.addComponent(UITransform).setContentSize(760, 96);
        this._op = this.node.addComponent(UIOpacity);
        this._op.opacity = 255;

        // 主标题：第 X 章（信号绿）
        const main = new Node('ChapterTitleMain');
        main.parent = this.node;
        main.layer = this.node.layer;
        main.setPosition(0, this.gap / 2, 0);
        main.addComponent(UITransform).setContentSize(760, 40);
        const mLbl = main.addComponent(Label);
        mLbl.fontSize = this.mainFontSize;
        mLbl.color = this.mainColor;
        FontManager.attachCJK(mLbl);
        mLbl.horizontalAlign = Label.HorizontalAlign.CENTER;
        mLbl.verticalAlign = Label.VerticalAlign.CENTER;
        this._main = mLbl;

        // 副标题：章名（灰白，可换行）
        const sub = new Node('ChapterTitleSub');
        sub.parent = this.node;
        sub.layer = this.node.layer;
        sub.setPosition(0, -this.gap / 2, 0);
        sub.addComponent(UITransform).setContentSize(760, 30);
        const sLbl = sub.addComponent(Label);
        sLbl.fontSize = this.subFontSize;
        sLbl.color = this.subColor;
        FontManager.attachCJK(sLbl);
        sLbl.horizontalAlign = Label.HorizontalAlign.CENTER;
        sLbl.verticalAlign = Label.VerticalAlign.CENTER;
        sLbl.enableWrapText = true;
        sLbl.lineHeight = this.subFontSize + 4;
        this._sub = sLbl;

        this._built = true;
    }
}
