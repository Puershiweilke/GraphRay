/**
 * ChapterDots.ts — 章节圆点导航（状态盘）
 *
 * 设计（用户确立）：
 *   - 圆点按章节数组生成（数据驱动，不硬编码 4）；每章一个圆点。
 *   - 三态着色，与全局 THEME 色板一致：
 *       绿 = 全部通关 / 橙 = 待通关（已解锁未全通）/ 灰 = 未解锁。
 *   - 函数勋章：已通关章的圆点佩戴一枚函数曲线徽章（GraphRay 标识，每章不同曲线：
 *     正弦/抛物/双峰/阻尼），进度(dots)与身份(勋章)合一；全通时整体转金。
 *     徽章为"勋章风格"渲染——淡填充盘 + 亮框 + 内嵌曲线，呼吸/高光游走做持久微动。
 *   - 选中态：外圈半透明光环 + 内填淡色。
 *   - 选中切换带过渡：选中环随 selT 缓动淡入 + 半径生长，整体轻微放大（pop），
 *     不再瞬间跳变（修复"缺乏过渡 / 等扫描动画播完才变"的感官问题）。
 *   - 交互：可跳转章点击 → onSelect(index)；未解锁章点击 → 抖动 + onSelectLocked(index, worldPos)。
 *   - 落位：由 Bootstrap 把本节点挂到 OrbitZone 中心（= 屏幕中心），rowY 控制圆点行纵向位置。
 *     坐标系为 Cocos 标准：+y=屏幕上方、-y=屏幕下方。默认 -410，落在轨道环下方的底部空白区；
 *     章名主副标题(ChapterTitle 组件)在轨道与 dots 之间，互不重叠。
 */

import { _decorator, Component, Node, Graphics, Color, UITransform, Vec3, tween, Tween } from 'cc';
import { THEME } from '../core/Theme';

const { ccclass, property } = _decorator;

export type ChapterState = 'done' | 'pending' | 'locked';

interface DotInfo {
    node: Node;         // 父节点：固定命中框 + 点击监听（永不缩放，保证相邻圆点始终可点）
    gNode: Node;        // 子节点：承载 Graphics，仅选中时缩放做 pop（不影响父节点命中框）
    g: Graphics;
    state: ChapterState;
    index: number;
    selT: number;       // 当前选中环进度 0..1（过渡动画用）
    selTarget: number;  // 目标进度 0/1
    home: Vec3;         // 圆点固定落位（抖动/动画的基准，避免位置漂移累积）
}

@ccclass('ChapterDots')
export class ChapterDots extends Component {

    @property({ tooltip: '圆点半径 (px)' })
    dotRadius: number = 13;

    @property({ tooltip: '选中外环半径增量 (px)' })
    selRingPad: number = 6;

    @property({ tooltip: '圆点水平间距 (px)' })
    spacing: number = 54;

    @property({ tooltip: '圆点行 Y（OrbitZone 局部坐标，+y=屏幕上方、-y=屏幕下方；Cocos 标准）。负值落底部，正值落顶部。数据驱动：可在 Inspector 实时调' })
    rowY: number = -410;

    @property({ tooltip: '已通关章圆点是否佩戴函数勋章（GraphRay 标识）。关闭则 done 圆点退化为普通实心点' })
    showFunctionMedal: boolean = true;

    private _dots: DotInfo[] = [];
    private _selected: number = -1;
    private _time: number = 0;
    private _allDone: boolean = false;

    /** 整体淡出系数（0=全透明,255=不透明），所有绘制 alpha 均乘此系数。
     *  Graphics 不读 UIOpacity，故用此方式整体淡出。圆点为控制级 UI，在切章时恒定（不参与扫描擦除）；
     *  此字段保留为可选钩子（例如未来若需在「进入关卡」时整体淡出圆点可由此驱动），默认恒为 255。 */
    transitionAlpha: number = 255;

    /** 选中某章（跳转）回调 */
    onSelect: ((index: number) => void) | null = null;
    /** 点击未解锁章回调（index, 世界坐标，用于弹提示） */
    onSelectLocked: ((index: number, worldPos: Vec3) => void) | null = null;

    // ==================== 数据 ====================

    /** 按章节状态数组重建圆点。states.length 即章节数（数据驱动） */
    setChapters(states: ChapterState[]): void {
        for (const d of this._dots) {
            if (d.node.isValid) d.node.destroy();
        }
        this._dots = [];

        const n = states.length;
        this._allDone = n > 0 && states.every(s => s === 'done');
        if (n === 0) return;
        const startX = -((n - 1) * this.spacing) / 2;

        for (let i = 0; i < n; i++) {
            const node = new Node(`ChapterDot_${i}`);
            node.parent = this.node;
            node.layer = this.node.layer;
            const size = (this.dotRadius + this.selRingPad + 4) * 2;   // 固定命中框（不随选中放大，避免覆盖相邻圆点）
            node.addComponent(UITransform).setContentSize(size, size);

            // 视觉子节点：承载 Graphics，选中时仅缩放此节点做 pop，父节点命中框恒定
            const gNode = new Node(`DotGfx_${i}`);
            gNode.parent = node;
            gNode.layer = node.layer;
            const isSel = (i === this._selected);
            gNode.setScale(isSel ? 1.18 : 1, isSel ? 1.18 : 1, 1);

            const g = gNode.addComponent(Graphics);
            const home = new Vec3(startX + i * this.spacing, this.rowY, 0);
            node.setPosition(home.x, home.y, 0);

            const info: DotInfo = { node, gNode, g, state: states[i], index: i, selT: isSel ? 1 : 0, selTarget: isSel ? 1 : 0, home };
            this._dots.push(info);
            this._drawDot(info);

            node.on(Node.EventType.TOUCH_END, () => this._onClick(info));
        }
    }

    /** 设置选中项（高亮切换，带过渡） */
    setSelected(index: number): void {
        if (this._selected === index) return;
        const prev = this._dots.find(d => d.index === this._selected);
        const cur = this._dots.find(d => d.index === index);
        this._selected = index;
        if (prev) { prev.selTarget = 0; }
        if (cur)  { cur.selTarget = 1; }
    }

    // ==================== 逐帧过渡 ====================

    update(dt: number): void {
        this._time += dt;
        const k = Math.min(1, dt * 14);   // 指数缓动，约 0.15~0.2s 收敛
        for (const d of this._dots) {
            // 选中过渡：缓动 selT 并随帧重绘
            const diff = d.selTarget - d.selT;
            if (Math.abs(diff) > 0.002) {
                d.selT += diff * k;
                this._drawDot(d);
            } else if (d.selT !== d.selTarget) {
                d.selT = d.selTarget;
                this._drawDot(d);
            }
            // 函数勋章：已通关章每帧重绘，做呼吸/高光游走（持久微动，"卫星在线"观感）
            else if (this.showFunctionMedal && d.state === 'done') {
                this._drawDot(d);
            }
        }
        // 扫描擦除淡出：过渡期间强制重绘所有圆点（应用 transitionAlpha）
        if (this.transitionAlpha < 255) this._redrawAll();
    }

    /** 将基础 alpha 按当前 transitionAlpha 缩放（扫描擦除整体淡出；Graphics 不读 UIOpacity） */
    private _a(v: number): number { return Math.floor(v * this.transitionAlpha / 255); }

    /** 重绘所有圆点（应用当前 transitionAlpha） */
    private _redrawAll(): void { for (const d of this._dots) this._drawDot(d); }

    // ==================== 绘制 ====================

    private _drawDot(info: DotInfo): void {
        const g = info.g;
        g.clear();
        const r = this.dotRadius;
        const c = info.state === 'done' ? THEME.chapterDone
            : info.state === 'pending' ? THEME.chapterPending
            : THEME.chapterLocked;

        const t = info.selT;   // 0..1 选中过渡进度
        // 选中环：随 t 淡入 + 半径生长；做成清晰"选中光环"（外辉 + 主环 + 内填），
        // 避免原先 2px 细环被误读为"不明的橙色细线"（pending 章选中时尤其明显）。
        if (t > 0.001) {
            const rr = r + this.selRingPad * t;
            g.strokeColor = new Color(c.r, c.g, c.b, this._a(35 * t));
            g.lineWidth = 7;
            g.circle(0, 0, rr + 2);
            g.stroke();
            g.strokeColor = new Color(c.r, c.g, c.b, this._a(210 * t));
            g.lineWidth = 3.5;
            g.circle(0, 0, rr);
            g.stroke();
            g.fillColor = new Color(c.r, c.g, c.b, this._a(50 * t));
            g.circle(0, 0, rr - 1.5);
            g.fill();
        }

        // 圆点本体
        if (info.state === 'done' && this.showFunctionMedal) {
            // 勋章风格：淡填充盘 + 亮框 + 内嵌函数曲线（GraphRay 标识，每章不同曲线）
            this._drawMedal(g, info, c);
        } else {
            g.fillColor = new Color(c.r, c.g, c.b, this._a(255));
            g.circle(0, 0, r);
            g.fill();
        }

        // 选中时整体轻微放大（pop）：仅缩放视觉子节点，父节点命中框恒定，
        // 故选中圆点不会因放大而覆盖相邻圆点的可点区域（修复"点不中相邻 dot"的命中框重叠）。
        const s = 1 + 0.18 * t;
        info.gNode.setScale(s, s, 1);
    }

    /** 已通关章圆点的函数勋章：实心环框 + 内嵌函数曲线（kind=章序号%4 区分章）+ 高光游走点。
     *  框用「外圈实心环 + 内盘回填」替代细描边圆——实心填充的边缘在 Cocos Graphics 中
     *  抗锯齿明显优于 2px 描边，消除勋章轮廓的锯齿感。全通时整体转金（"全网在线"质变）。 */
    private _drawMedal(g: Graphics, info: DotInfo, base: Color): void {
        const col = this._allDone ? THEME.chapterDoneBadge : base;
        const r = this.dotRadius;
        const mr = r + 2;                 // 勋章外框半径（略大于圆点，读作徽章）
        const fr = 2;                     // 环厚（实心环，抗锯齿优于描边）
        const half = mr * 0.95;          // 曲线半宽（收在框内，标准徽章观感）
        const amp = mr * 0.5;             // 曲线振幅
        const kind = info.index % 4;      // 每章一种函数：0 正弦 / 1 抛物 / 2 双峰 / 3 阻尼

        // 勋章：外圈实心环（边框色，作背景框）——调低透明度让前景曲线更突出（解决"前景后景太相近"）
        g.fillColor = new Color(col.r, col.g, col.b, this._a(95));
        g.circle(0, 0, mr); g.fill();
        // 内盘（base 色，半透明压暗，作为曲线背景；比外圈略实，形成清晰两调）
        g.fillColor = new Color(base.r, base.g, base.b, this._a(110));
        g.circle(0, 0, mr - fr); g.fill();

        // 内嵌函数曲线
        const N = 22;
        g.lineWidth = 2.4;
        g.strokeColor = new Color(col.r, col.g, col.b, this._a(235));
        let first = true;
        for (let i = 0; i <= N; i++) {
            const u = i / N;
            const lx = (u - 0.5) * 2;          // -1..1
            const ly = this._curveY(kind, lx);
            const px = lx * half, py = -ly * amp;   // 屏幕 y 向下，取负使曲线向上为正
            if (first) { g.moveTo(px, py); first = false; }
            else g.lineTo(px, py);
        }
        g.stroke();

        // 高光游走点（显活跃，不抢眼）
        const p = Math.sin(this._time * 1.0 + info.index * 0.7) * 0.5 + 0.5;
        const lx = (p - 0.5) * 2;
        const ly = this._curveY(kind, lx);
        g.fillColor = new Color(col.r, col.g, col.b, this._a(235));
        g.circle(lx * half, -ly * amp, 2.6); g.fill();
    }

    /** 归一化函数曲线（lx ∈ [-1,1] → ly，幅度约 [-1,1]），按 kind 区分章。 */
    private _curveY(kind: number, lx: number): number {
        switch (kind) {
            case 0: return Math.sin(lx * Math.PI * 2.5);            // 正弦
            case 1: return lx * lx * 1.3 - 0.35;                    // 抛物
            case 2: return Math.sin(lx * Math.PI * 4.0);            // 双峰
            default: return Math.sin(lx * Math.PI * 2.0) * (1 - Math.abs(lx) * 0.6); // 阻尼
        }
    }

    // ==================== 交互 ====================

    private _onClick(info: DotInfo): void {
        if (info.state === 'locked') {
            this._shake(info);
            this.onSelectLocked?.(info.index, info.node.worldPosition.clone());
            return;
        }
        this.onSelect?.(info.index);
    }

    /** 锁定态轻提示：左右抖动（始终以固定 home 为基准，并取消上一次未完成的抖动，
     *  避免连续点击未解锁 dot 时位移逐次累积向左漂移） */
    private _shake(info: DotInfo): void {
        const node = info.node;
        Tween.stopAllByTarget(node);   // 取消上一次抖动，防止位置漂移累积
        const hx = info.home.x, hy = info.home.y;
        tween(node)
            .to(0.05, { position: new Vec3(hx - 6, hy, 0) })
            .to(0.05, { position: new Vec3(hx + 6, hy, 0) })
            .to(0.05, { position: new Vec3(hx - 4, hy, 0) })
            .to(0.05, { position: new Vec3(hx + 4, hy, 0) })
            .to(0.05, { position: new Vec3(hx, hy, 0) })
            .start();
    }
}
