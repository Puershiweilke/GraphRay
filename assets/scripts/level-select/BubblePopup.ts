/**
 * BubblePopup.ts — 气泡弹出面板（数据驱动架构）
 *
 * 所有视觉参数均为 @property，可在 Cocos Creator 编辑器面板中实时调试修改。
 * 点击关卡节点 → 从节点旁弹出浮动面板，带引导线连接角括号。
 *
 * 方向：左节点→右弹，右节点→左弹
 * 动画：面板 scaleY 0→1（顶部展开）+ 文字延迟淡入
 *
 * 底部内嵌「进入关卡」主 CTA（风格与 HUD 统一：信号绿填充胶囊，无可变 border 粗细）。
 * 锁定关显示「未解锁」并禁用。入口逻辑由 Bootstrap 通过 onEnter 注入。
 */

import { _decorator, Component, Graphics, Label, Node, Color, UITransform, UIOpacity, Button, tween, Tween, Vec3 } from 'cc';
import { FontManager } from '../core/FontManager';
import { CursorStyle } from '../ui-tools/CursorStyle';

const { ccclass, property } = _decorator;

@ccclass('BubblePopup')
export class BubblePopup extends Component {

    // ============================================================
    // 面板基础
    // ============================================================

    /** 面板最大宽度。文字过长时会自动换行，不会超出此值 */
    @property({ tooltip: '面板最大宽度 (px)' })
    maxWidth: number = 300;

    /** 面板最小宽度 */
    @property({ tooltip: '面板最小宽度 (px)' })
    minWidth: number = 200;

    /** 面板最小高度 */
    @property({ tooltip: '面板最小高度 (px)' })
    minHeight: number = 120;

    /** 面板圆角半径 */
    @property({ tooltip: '面板圆角半径 (px)' })
    roundR: number = 6;

    /** 面板左右内边距 */
    @property({ tooltip: '面板左右内边距 (px)' })
    padH: number = 20;

    /** 面板底部内边距 */
    @property({ tooltip: '面板底部内边距 (px)' })
    padBottom: number = 16;

    /** 面板距离目标节点的间距 */
    @property({ tooltip: '节点圆心到面板边缘的间距 (px)' })
    nodeGap: number = 36;

    /** 面板初始生成时的额外上移量 (px)：正值=整体抬高，让气泡起点更靠上 */
    @property({ tooltip: '初始生成时面板额外上移 (px，正值抬高)' })
    spawnOffsetY: number = 20;

    // ============================================================
    // 色彩
    // ============================================================

    @property({ type: Color, tooltip: '面板底色' })
    colorPanel: Color = new Color(26, 26, 26, 235);

    @property({ type: Color, tooltip: '信号色（标签/引导线/角括号/标题）' })
    colorAccent: Color = new Color(158, 255, 0);

    @property({ type: Color, tooltip: '面板外框颜色' })
    colorBorder: Color = new Color(60, 60, 60, 200);

    @property({ type: Color, tooltip: 'CRT 网格线颜色' })
    colorGrid: Color = new Color(158, 255, 0, 6);

    @property({ type: Color, tooltip: '四角 L 形括号颜色' })
    colorCorner: Color = new Color(158, 255, 0, 90);

    @property({ type: Color, tooltip: '引导线颜色' })
    colorGuide: Color = new Color(158, 255, 0, 210);

    @property({ type: Color, tooltip: '标题文字颜色' })
    colorTitle: Color = new Color(255, 255, 255);

    @property({ type: Color, tooltip: '描述文字颜色' })
    colorDesc: Color = new Color(200, 200, 200);

    /** 标签栏底条透明度（0-255，叠加在面板底色上） */
    @property({ tooltip: '标签栏底条 alpha (0-255)' })
    tagBarAlpha: number = 18;

    // ============================================================
    // 标签栏
    // ============================================================

    /** 标签栏高度。标签文字垂直居中于此高度内 */
    @property({ tooltip: '标签栏高度 (px)' })
    tagBarH: number = 34;

    /** 标签文字内容 */
    @property({ tooltip: '标签栏文字' })
    tagText: string = '◆  目前可以公开的情报';

    /** 标签文字字号 */
    @property({ tooltip: '标签字号 (px)' })
    tagFontSize: number = 16;

    // ============================================================
    // 标题
    // ============================================================

    /** 标签栏底部到标题顶部的间距 */
    @property({ tooltip: '标签 → 标题的间距 (px)' })
    gapTitle: number = 25;

    /** 标题字号 */
    @property({ tooltip: '标题字号 (px)' })
    titleFontSize: number = 22;

    /** 标题区域高度（含上下内边距） */
    @property({ tooltip: '标题区高度 (px)' })
    titleH: number = 42;

    // ============================================================
    // 描述
    // ============================================================

    /** 标题底部到描述顶部的间距 */
    @property({ tooltip: '标题 → 描述的间距 (px)' })
    gapDesc: number = 0;

    /** 描述字号 */
    @property({ tooltip: '描述字号 (px)' })
    descFontSize: number = 18;

    /** 描述行高 */
    @property({ tooltip: '描述行高 (px)' })
    descLineHeight: number = 22;

    // ============================================================
    // 「进入关卡」CTA（底部主按钮）
    // ============================================================

    /** CTA 高度 */
    @property({ tooltip: 'CTA 高度 (px)' })
    ctaH: number = 40;

    /** 描述区与 CTA 的间距 (px) */
    @property({ tooltip: '描述区 → CTA 的间距 (px)' })
    ctaGapTop: number = 14;

    /** CTA 文案（可进入、且未通关时） */
    @property({ tooltip: 'CTA 文案（可进入、未通关时）' })
    ctaText: string = '进入关卡  >';

    /** CTA 文案（可进入、且已通关时，即重玩） */
    @property({ tooltip: 'CTA 文案（已通关、重玩时）' })
    ctaReplayText: string = '再次进入  >';

    /** CTA 文案（锁定/不可进入时） */
    @property({ tooltip: 'CTA 文案（锁定/不可进入时）' })
    ctaLockText: string = '未解锁';

    /** CTA 文案（关卡待完成时） */
    @property({ tooltip: 'CTA 文案（关卡待完成时）' })
    ctaNotBuiltText: string = '关卡待完成';

    /** CTA 圆角半径 */
    @property({ tooltip: 'CTA 圆角半径 (px)' })
    ctaRadius: number = 6;

    @property({ type: Color, tooltip: 'CTA 填充色（信号绿，与 HUD 统一）' })
    ctaFill: Color = new Color(158, 255, 0);

    @property({ type: Color, tooltip: 'CTA 文字色（深底，绿上压暗字）' })
    ctaTextColor: Color = new Color(20, 20, 20);

    @property({ type: Color, tooltip: 'CTA 填充色（不可进入时，暗灰）' })
    ctaFillLocked: Color = new Color(58, 58, 58);

    @property({ type: Color, tooltip: 'CTA 文字色（不可进入时，弱灰）' })
    ctaTextLocked: Color = new Color(140, 140, 140);

    // ============================================================
    // 角括号
    // ============================================================

    /** L 形括号每边臂长 */
    @property({ tooltip: '角括号臂长 (px)' })
    cornerArm: number = 15;

    /** L 形括号距面板角的内缩量 */
    @property({ tooltip: '角括号距面板边缘的距离 (px)' })
    cornerInset: number = 0;

    /** 角括号线宽 */
    @property({ tooltip: '角括号线宽 (px)' })
    cornerLW: number = 4;

    // ============================================================
    // 引导线
    // ============================================================

    /** 引导线核心虚线线宽（细化：默认比面板描边更细） */
    @property({ tooltip: '引导线虚线线宽 (px)' })
    guideLW: number = 2;

    /** 虚线：实段长 */
    @property({ tooltip: '虚线实段长 (px)' })
    guideDash: number = 6;

    /** 虚线：间隔长 */
    @property({ tooltip: '虚线间隔长 (px)' })
    guideGap: number = 5;

    /** 羽化光晕半宽（外围柔光，越大越虚） */
    @property({ tooltip: '羽化光晕半宽 (px)' })
    guideGlowW: number = 5;

    /** 羽化光晕透明度 (0-255，越小越柔) */
    @property({ tooltip: '羽化光晕 alpha (0-255)' })
    guideGlowAlpha: number = 45;

    /** 引导线落点相对顶边的下偏量 (px)。
     *  落点【固定锁在上方近角】（不再随节点位置在顶/底角间翻转，根除开场乱串），
     *  并向下偏移此值，使落点落在边角纵坐标附近、略离开顶边，视觉重心更居中。 */
    @property({ tooltip: '引导线落点下偏量 (px)，固定落上方角 + 略下移' })
    guideCornerDrop: number = 7;

    // ============================================================
    // 节点
    // ============================================================

    /** 关卡节点半径，用于计算节点边缘到面板的间距 */
    @property({ tooltip: '关卡节点半径 (px)' })
    nodeRadius: number = 28;

    /** 面板 Y 边界钳制用的可视区域总高度 (px)。默认 1080 = 整屏高度；
     *  气泡过高时整体上移/下移以完整留在区域内，放不下则纵向居中（不截断内容）。 */
    @property({ tooltip: '钳制区域总高度 (px)，默认 1080 = 整屏' })
    orbitH: number = 1080;

    // ============================================================
    // 动画
    // ============================================================

    /** 面板展开时长 */
    @property({ tooltip: '面板展开动画时长 (s)' })
    animOpenDur: number = 0.35;

    /** 文字开始淡入的延迟（该值应 ≈ animOpenDur × 0.7） */
    @property({ tooltip: '文字淡入延迟 (s)' })
    animTextDelay: number = 0.25;

    /** 文字淡入时长 */
    @property({ tooltip: '文字淡入时长 (s)' })
    animFadeDur: number = 0.2;

    /** 面板关闭时长 */
    @property({ tooltip: '面板关闭时长 (s)' })
    animCloseDur: number = 0.2;

    // ============================================================
    // 运行时状态
    // ============================================================

    /** 目标节点在 OrbitZone 的本地坐标（Bootstrap 写入） */
    targetPos: Vec3 = new Vec3();

    private _bgG: Graphics | null = null;
    private _titleLabel: Label | null = null;
    private _tagLabel: Label | null = null;
    private _descLabel: Label | null = null;
    private _uiOpacity: UIOpacity | null = null;
    private _pw: number = 240;
    private _ph: number = 160;
    private _openRight: boolean = true;

    // CTA
    private _ctaNode: Node | null = null;
    private _ctaGfx: Graphics | null = null;
    private _ctaLabel: Label | null = null;
    private _ctaBtn: Button | null = null;
    private _enterable: boolean = false;
    private _built: boolean = false;     // 作者是否已制作该关（来自 chapters.json）
    private _replay: boolean = false;    // 玩家是否已通关（来自 getLevelStatus === COMPLETE，只读）
    private _onEnter: (() => void) | null = null;

    // 引导线：与面板共用 _bgG 绘制（同一坐标系 + 同一渲染通道，确保可见），逐帧跟随关卡节点摆动
    private _targetNode: Node | null = null;
    private _shown: boolean = false;
    private _tmpV3: Vec3 = new Vec3();
    // 节点在【气泡本地坐标系】中的坐标（show 初值来自 targetPos 偏移；逐帧来自节点实时坐标）
    private _nodeLocalX: number = 0;
    private _nodeLocalY: number = 0;

    // ==================== 尺寸 ====================

    /** 估算面板宽度（受 maxWidth / minWidth 钳制）；高度由 _measureDescHeight 实测后于 show() 内组装 */
    private _calcWidth(title: string, desc: string): number {
        const maxCW = this.maxWidth - this.padH * 2;
        const tw = this._estW(title, this.titleFontSize, maxCW);
        const dw = this._estW(desc, this.descFontSize, maxCW);
        return Math.min(this.maxWidth, Math.max(this.minWidth, Math.max(tw, dw) + this.padH * 2));
    }

    /**
     * 实测描述文本在给定宽度 cw 下的渲染高度。
     * 关键点：描述 Label 用 Overflow.RESIZE_HEIGHT，其真实高度由字体度量决定，
     * 不能靠字符累加估算（估算偏低会导致面板偏矮、文本溢出到 CTA 下方）。
     * 这里强制 Label 按 cw 重排并读取真实 UITransform 高度；测量异常时用估算兜底。
     */
    private _measureDescHeight(desc: string, cw: number): number {
        const lb = this._descLabel!;
        const ut = lb.node.getComponent(UITransform) || lb.node.addComponent(UITransform);
        ut.setContentSize(cw, this.descLineHeight);
        lb.string = desc;
        lb.updateRenderData(true);
        const actual = lb.node.getComponent(UITransform)!.height;
        const est = this._estLines(desc, this.descFontSize, cw) * this.descLineHeight;
        return Math.max(actual, est, this.descLineHeight);
    }

    private _estW(t: string, fs: number, mw: number): number {
        let w = 0;
        for (const c of t) w += /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(c) ? fs : fs * 0.55;
        return Math.min(w + 4, mw);
    }

    private _estLines(t: string, fs: number, mw: number): number {
        let line = 0, n = 1;
        for (const c of t) {
            line += /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(c) ? fs : fs * 0.55;
            if (line > mw) { n++; line -= mw; }
        } return Math.max(n, 1);
    }

    // ==================== 生命周期 ====================

    onLoad(): void {
        this._uiOpacity = this.node.addComponent(UIOpacity); this._uiOpacity.opacity = 255;
        this._bgG = this.node.addComponent(Graphics);

        // 注意：弹窗根节点【不】持有 UITransform。
        // 原因：默认 UITransform 为 100×100 命中框；且弹窗是 OrbitZone 最后添加的子节点（最高 z），
        // 会盖住背后的相邻关卡节点并吞掉其点击（现象："打开某关弹窗后，相邻关点不中，须先点别的关再回来才行"）。
        // 去掉根命中框后，透明区域点击穿透；仅 CTA 子节点自带 UITransform+Button 可点。
        // 锚点无需设置（无 UITransform）；子节点均用 setPosition 在本地坐标系布局，不受根锚点影响。
        // 展开动画 scaleY 0→1 仍正确：Graphics 以节点原点(局部 y=0=面板顶边)为基准绘制，缩放即自顶向下展开。

        const mk = (n: string, fs: number, c: Color, o?: Label.Overflow) => {
            const nd = new Node(n); nd.parent = this.node; nd.layer = this.node.layer;
            const l = nd.addComponent(Label); l.fontSize = fs; l.color = c; FontManager.attachCJK(l);
            if (o !== undefined) l.overflow = o; return l;
        };
        this._tagLabel = mk('tagLabel', this.tagFontSize, this.colorAccent);
        this._tagLabel.string = this.tagText;
        this._titleLabel = mk('titleLabel', this.titleFontSize, this.colorTitle, Label.Overflow.SHRINK);
        this._descLabel = mk('descLabel', this.descFontSize, this.colorDesc, Label.Overflow.RESIZE_HEIGHT);
        this._descLabel.lineHeight = this.descLineHeight;

        // CTA 节点（独立子节点，自绘填充胶囊 + Label + Button）
        const cta = new Node('ctaEnter');
        cta.parent = this.node; cta.layer = this.node.layer;
        cta.addComponent(UITransform).setContentSize(this._pw - this.padH * 2, this.ctaH);
        cta.addComponent(UIOpacity).opacity = 255;
        this._ctaGfx = cta.addComponent(Graphics);
        const cl = new Node('ctaLabel'); cl.parent = cta; cl.layer = cta.layer;
        cl.addComponent(UITransform).setContentSize(this._pw - this.padH * 2, this.ctaH);
        this._ctaLabel = cl.addComponent(Label);
        this._ctaLabel.fontSize = 18; this._ctaLabel.color = this.ctaTextColor;
        FontManager.attachCJK(this._ctaLabel);
        this._ctaLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this._ctaLabel.verticalAlign = Label.VerticalAlign.CENTER;
        this._ctaLabel.string = this.ctaText;
        this._ctaBtn = cta.addComponent(Button);
        this._ctaBtn.transition = Button.Transition.SCALE;   // 按下缩放反馈（谏言 #3）
        this._ctaBtn.zoomScale = 0.95;
        this._ctaBtn.duration = 0.1;
        this._ctaNode = cta;
        cta.addComponent(CursorStyle).cursorType = 'pointer';   // 悬停手型
        this._ctaBtn.node.on(Button.EventType.CLICK, () => { if (this._enterable) this._onEnter?.(); });
    }

    // ==================== 公开 ====================

    show(target: Vec3, title: string, desc: string,
         opts?: { enterable?: boolean; completed?: boolean; replay?: boolean; targetNode?: Node; onEnter?: (() => void) }): void {
        this.targetPos = target.clone();
        this._titleLabel!.string = title;
        this._descLabel!.string = desc;
        this._enterable = opts?.enterable ?? false;
        this._built     = opts?.completed ?? false;
        this._replay    = opts?.replay ?? false;
        this._targetNode = opts?.targetNode ?? null;   // 实时节点引用：引导线逐帧跟随其浮动
        this._shown     = true;
        this._onEnter   = opts?.onEnter ?? null;

        // 标签栏始终显示情报标题；关卡状态（待完成 / 未解锁 / 已通关）已体现在底部 CTA 文案上，不在标签栏重复
        this._tagLabel!.string = this.tagText;

        // 面板尺寸：宽度按估算钳制；高度由【实测】描述文本高度驱动，
        // 保证 CTA 始终位于文本下方（带 ctaGapTop 边距），绝不重叠。
        const w  = this._calcWidth(title, desc);
        const cw = Math.min(this.maxWidth, w) - this.padH * 2;   // 实际显示的内容宽度，实测与绘制一致
        const descH = this._measureDescHeight(desc, cw);
        const overhead = this.tagBarH + this.gapTitle + this.titleH + this.gapDesc;
        const h = overhead + descH + this.ctaGapTop + this.ctaH + this.padBottom;
        this._pw = Math.min(this.maxWidth, w);
        this._ph = Math.max(this.minHeight, h);

        this._calcPosition();
        // 用「scale=1 假设」推导节点在气泡本地坐标中的位置（local = 节点世界坐标 − 气泡世界坐标），
        // 与 update 中 _updateNodeLocal 完全同一公式。展开动画期间整块面板随 scale 放大，引导线端点世界位置
        // = (tw-pw)*scale，从气泡中心平滑「生长」到节点，scale=1 时正中节点；不再 ÷scale（避免动画初期
        // scale≈0 时坐标暴涨 / 虚线被 MAX_PER_SEG 截断 / 首帧除零守卫用旧值 → 起点「特别低」异常）。
        this.node.updateWorldTransform(true);
        if (this._targetNode) this._targetNode.updateWorldTransform(true);
        this._updateNodeLocal();
        this._drawAll();
        this._animateOpen();
    }

    hide(): Promise<void> {
        this._shown = false;
        // 1. 文字 + CTA 即时淡出 100ms
        const fadeNodes: Node[] = [this._tagLabel!.node, this._titleLabel!.node, this._descLabel!.node];
        if (this._ctaNode?.isValid) fadeNodes.push(this._ctaNode);
        for (const nd of fadeNodes) {
            if (!nd.isValid) continue;
            const op = nd.getComponent(UIOpacity) || nd.addComponent(UIOpacity);
            tween(op).to(0.1, { opacity: 0 }).start();
        }
        // 2. 面板延迟收缩 200ms
        return new Promise(resolve => {
            this.scheduleOnce(() => {
                tween(this.node).to(this.animCloseDur, { scale: new Vec3(1, 0, 1) })
                    .call(() => resolve()).start();
            }, 0.1);
        });
    }

    // ==================== 位置 ====================

    private _calcPosition(): void {
        const tx = this.targetPos.x, ty = this.targetPos.y;
        this._openRight = tx < 0;
        const s = this._openRight ? 1 : -1;
        const px = tx + s * (this.nodeRadius + this.nodeGap + this._pw / 2);
        // 顶部边缘钳制在轨道区上界内；底部边缘（topY - 面板高度）钳制在下界内，整体保证不溢出
        // 期望顶边大致对齐节点上沿，再额外上抬 spawnOffsetY（默认 +20px）
        const desiredTop = ty + this.nodeRadius + this.spawnOffsetY;

        // 钳制：保证整块面板落在可视区域内；放不下时整体上移/下移，
        // 若连整屏都放不下则纵向居中（超出部分由用户缩减文本量解决，绝不截断内容）。
        const half = this.orbitH / 2;
        let topY: number;
        if (this._ph <= 2 * half) {
            topY = Math.max(-half + this._ph, Math.min(half, desiredTop));
        } else {
            topY = this._ph / 2;
        }
        this.node.setPosition(px, topY, 0);
    }

    // ==================== 绘制 ====================

    private _drawAll(): void {
        // 面板 + 引导线共用同一 Graphics（_bgG）：同一坐标系（面板顶边中心为原点）+ 同一渲染通道，
        // 确保引导线一定可见（之前独立子节点 Graphics 因无 UITransform 未被 UI 渲染流纳入而整条不可见）。
        const g = this._bgG!; g.clear();
        this._drawPanel(g);
        this._drawGuide(g);
        this._updateLabels();
        this._drawCta();
    }

    private _drawPanel(g: Graphics): void {
        const w = this._pw, h = this._ph;
        // 兜底：尺寸非有限或非法 → 不绘制，避免网格 for 循环在异常高度下失控
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
        const hw = w / 2, r = this.roundR;
        const top = 0, bot = -h;

        g.fillColor = this.colorPanel;
        g.roundRect(-hw, bot, w, h, r); g.fill();
        g.strokeColor = this.colorBorder; g.lineWidth = 1;
        g.roundRect(-hw, bot, w, h, r); g.stroke();

        // 网格
        g.strokeColor = this.colorGrid; g.lineWidth = 0.5;
        for (let y = bot + 4; y < top; y += 3) { g.moveTo(-hw + 4, y); g.lineTo(hw - 4, y); g.stroke(); }

        // 角括号
        const cl = this.cornerArm, co = this.cornerInset;
        g.strokeColor = this.colorCorner; g.lineWidth = this.cornerLW;
        g.moveTo(-hw + co,        top - co - cl); g.lineTo(-hw + co,        top - co); g.lineTo(-hw + co + cl,   top - co); g.stroke();
        g.moveTo(hw - co - cl,    top - co);       g.lineTo(hw - co,         top - co); g.lineTo(hw - co,         top - co - cl); g.stroke();
        g.moveTo(-hw + co,        bot + co + cl);  g.lineTo(-hw + co,        bot + co); g.lineTo(-hw + co + cl,   bot + co); g.stroke();
        g.moveTo(hw - co - cl,    bot + co);       g.lineTo(hw - co,         bot + co); g.lineTo(hw - co,         bot + co + cl); g.stroke();

        // 标签栏底条
        g.fillColor = new Color(this.colorAccent.r, this.colorAccent.g, this.colorAccent.b, this.tagBarAlpha);
        g.rect(-hw, top - this.tagBarH, w, this.tagBarH); g.fill();

        // （引导线改为 L 形折线，从面板某一近角出发，见 _drawGuide）
    }

    /**
     * 引导线（画在面板同一 _bgG 上，确保始终可见）：
     *  - 路径：L 形正交折线 —— 从面板朝向节点一侧的【某一个近角】出发，
     *          先水平延伸至节点 X 对齐处，再垂直落到节点边缘；
     *          这样线头明确锚在气泡的四个角之一，指向关系一目了然。
     *  - 样式：虚线核心（细、亮）+ 外围羽化光晕（宽、低透明填充带），
     *          二者均用 fill 实现，避免与面板描边互相污染。
     * 坐标体系：气泡本地坐标（原点 = 面板顶边中心，+y 向上、向下为负）。
     */
    private _drawGuide(g: Graphics): void {
        const pts = this._buildGuidePolyline();
        if (pts.length < 2) return;
        for (const p of pts) {
            if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
        }

        // （1）羽化光晕：沿折线填充宽带状（淡），fill() 后清空 path
        g.fillColor = new Color(this.colorGuide.r, this.colorGuide.g, this.colorGuide.b, this.guideGlowAlpha);
        this._fillGlow(g, pts, this.guideGlowW);

        // （2）虚线核心：沿折线填充小四边形（亮），覆盖在光晕之上
        g.fillColor = this.colorGuide;
        this._drawDashedPolyline(g, pts, this.guideLW, this.guideDash, this.guideGap);
    }

    /** 构造引导线折线（气泡本地坐标）：[近角, 水平拐点, 节点边缘点] */
    private _buildGuidePolyline(): { x: number; y: number }[] {
        const w = this._pw, r = this.nodeRadius;
        const openR = this._openRight;                       // 节点在左→面板在右→近边=左；反之近边=右
        const nearX = openR ? -w / 2 : w / 2;               // 面板近边 x
        // 落点【固定锁在上方近角】：不再随 _nodeLocalY 在 0 / -h 间翻转（开场动画 scale 变化会让
        // _nodeLocalY 抖动 → 角在顶/底跳 → 视觉乱串）。并向下偏移 guideCornerDrop，
        // 落点落在边角纵坐标附近、略离开顶边，视觉重心更居中。
        const cornerY = -this.guideCornerDrop;
        const corner = { x: nearX, y: cornerY };
        // 节点朝向面板一侧的【上角】（左上 / 右上，取决于面板在节点哪侧）：
        // edgeX 取气泡侧那一边的边缘，edgeY 取节点顶边（nodeLocalY + r），
        // 故线头钉在关卡节点的上角，而非侧心。
        const edgeX = openR ? (this._nodeLocalX + r) : (this._nodeLocalX - r);
        const edge = { x: edgeX, y: this._nodeLocalY + r };
        return [corner, { x: edgeX, y: cornerY }, edge];     // L 形：角 → 水平拐点 → 节点上角
    }

    /** 沿折线填充一条宽 gw 的发光带（顶点法线偏移，近似圆角） */
    private _fillGlow(g: Graphics, pts: { x: number; y: number }[], gw: number): void {
        const m = pts.length;
        if (m < 2) return;
        const left: { x: number; y: number }[] = [];
        const right: { x: number; y: number }[] = [];
        for (let i = 0; i < m; i++) {
            const prev = pts[Math.max(0, i - 1)];
            const next = pts[Math.min(m - 1, i + 1)];
            let tx = next.x - prev.x, ty = next.y - prev.y;
            const tl = Math.hypot(tx, ty);
            if (tl < 1e-6) { tx = 1; ty = 0; }
            const nx = -ty / tl, ny = tx / tl;
            left.push({ x: pts[i].x + nx * gw, y: pts[i].y + ny * gw });
            right.push({ x: pts[i].x - nx * gw, y: pts[i].y - ny * gw });
        }
        g.moveTo(left[0].x, left[0].y);
        for (let i = 1; i < m; i++) g.lineTo(left[i].x, left[i].y);
        for (let i = m - 1; i >= 0; i--) g.lineTo(right[i].x, right[i].y);
        g.close();
        g.fill();
    }

    /** 沿折线以填充小四边形的方式画虚线（带上限防卡死） */
    private _drawDashedPolyline(g: Graphics, pts: { x: number; y: number }[], lw: number, dash: number, gap: number): void {
        const t = lw / 2;
        const step = Math.max(1e-3, dash + gap);   // 步长强制为正，避免用户在 Inspector 调到 ≤0 时死循环
        const dDash = Math.max(0.5, dash);          // 实段长强制为正
        const MAX_PER_SEG = 2000;                   // 每段虚线硬上限，杜绝 O(长度) 卡死
        for (let i = 0; i < pts.length - 1; i++) {
            const x0 = pts[i].x, y0 = pts[i].y, x1 = pts[i + 1].x, y1 = pts[i + 1].y;
            const dx = x1 - x0, dy = y1 - y0;
            const len = Math.hypot(dx, dy);
            if (!Number.isFinite(len) || len <= 1e-3) continue;
            const ux = dx / len, uy = dy / len;
            const nx = -uy, ny = ux;
            let d = 0, c = 0;
            while (d < len && c++ < MAX_PER_SEG) {
                const s = d, e = Math.min(d + dDash, len);
                const ax = x0 + ux * s, ay = y0 + uy * s;
                const bx = x0 + ux * e, by = y0 + uy * e;
                g.moveTo(ax - nx * t, ay - ny * t);
                g.lineTo(ax + nx * t, ay + ny * t);
                g.lineTo(bx + nx * t, by + ny * t);
                g.lineTo(bx - nx * t, by - ny * t);
                g.close();
                d += step;
            }
        }
        g.fill();
    }

    /**
     * 每帧：若正在显示且目标节点有效，重绘面板 + 引导线，使连线末端始终粘在关卡节点上。
     */
    update(dt: number): void {
        // 防御：场景切换 / 节点销毁过程中，本组件可能处于半销毁态，先校验存活再绘制。
        if (!this._shown || !this.node.isValid) return;
        if (!this._targetNode || !this._targetNode.isValid) return;

        // scale=1 假设推导节点本地坐标（见 _updateNodeLocal）：与 show() 首帧公式完全一致，
        // 动画全程坐标连续、不会跳变（根除乱串）；不再受 scale≈0 放大影响。
        this._updateNodeLocal();

        // 引导线与面板共用 _bgG：整块重绘（面板 + 引导线）。Label/CTA 为独立子节点，不受此 clear 影响。
        const g = this._bgG!; g.clear();
        this._drawPanel(g);
        this._drawGuide(g);
    }

    /**
     * 计算目标节点在【气泡本地坐标系】中的位置，写入 _nodeLocalX/Y。
     * 公式：本地偏移 = (节点世界坐标 − 气泡世界坐标) ÷ 气泡缩放。
     *   - 使用世界坐标差而非父空间坐标差，可免疫 OrbitZone / LevelNodePool 等任意祖先变换；
     *   - 除以气泡自身缩放，保证即使展开动画期间 scale<1，连线末端也精确落在节点世界上（不飘、不乱串）。
     */
    private _updateNodeLocal(): void {
        if (!this._targetNode || !this._targetNode.isValid) return;
        // scale=1 假设：local = 节点世界坐标 − 气泡世界坐标。
        // 不再除以气泡缩放（旧做法在展开动画 scale≈0 时坐标暴涨 → 虚线被 MAX_PER_SEG 截断、
        // 且首帧 scale=0 时除零守卫导致用旧值 → 引导线起点「特别低」的异常）。
        // 改用 scale=1 假设后：展开动画期间整块面板随 scale 放大，引导线端点世界位置 = (tw-pw)*scale，
        // 从气泡中心平滑「生长」到节点，scale=1 时正中节点；动画结束后精确钉在节点上（含浮动）。
        this.node.updateWorldTransform(true);
        this._targetNode.updateWorldTransform(true);
        const pw = this.node.worldPosition;
        const tw = this._targetNode.worldPosition;
        this._nodeLocalX = tw.x - pw.x;
        this._nodeLocalY = tw.y - pw.y;
    }

    /** 节点销毁时清理：断开跨场景引用、停掉残留 tween / 定时器，
     *  防止场景切换时往已销毁组件写属性导致引擎内部 equals(null) 崩溃。 */
    onDestroy(): void {
        this._shown = false;
        this._targetNode = null;
        Tween.stopAllByTarget(this.node);
        this.unscheduleAllCallbacks();
    }

    /** CTA 填充胶囊（信号绿 / 锁定暗灰），文案随状态切换 */
    private _drawCta(): void {
        if (!this._ctaGfx) return;
        const w = this._pw - this.padH * 2, h = this.ctaH;
        const g = this._ctaGfx; g.clear();
        if (this._enterable) {
            g.fillColor = this.ctaFill;
            g.roundRect(-w / 2, -h / 2, w, h, this.ctaRadius); g.fill();
            if (this._ctaLabel) {
                this._ctaLabel.string = this._replay ? this.ctaReplayText : this.ctaText;
                this._ctaLabel.color = this.ctaTextColor;
            }
            if (this._ctaBtn) this._ctaBtn.interactable = true;
        } else {
            g.fillColor = this.ctaFillLocked;
            g.roundRect(-w / 2, -h / 2, w, h, this.ctaRadius); g.fill();
            if (this._ctaLabel) {
                this._ctaLabel.string = this._built ? this.ctaLockText : this.ctaNotBuiltText;
                this._ctaLabel.color = this.ctaTextLocked;
            }
            if (this._ctaBtn) this._ctaBtn.interactable = false;
        }
    }

    // ==================== Label ====================

    private _updateLabels(): void {
        const w = this._pw, h = this._ph;
        const cw = w - this.padH * 2;

        // 标签栏文字：在标签栏高度内【垂直居中】（标签栏高 tagBarH，文字框高=tagBarH，中心点落在 -tagBarH/2）
        const tl = this._tagLabel!;
        const tut = tl.node.getComponent(UITransform) || tl.node.addComponent(UITransform);
        tut.anchorX = 0.5;   // 水平居中：框宽 cw、中心 x=0 → 左缘恰落在 -pw/2 + padH（与标题/描述左对齐）
        tut.anchorY = 0.5;
        tut.setContentSize(cw, this.tagBarH);
        tl.horizontalAlign = Label.HorizontalAlign.LEFT;
        tl.verticalAlign = Label.VerticalAlign.CENTER;
        tl.node.setPosition(0, -this.tagBarH / 2, 0);

        this._setLabel(this._titleLabel!, cw, this.titleH, -this.tagBarH - this.gapTitle);
        this._setLabel(this._descLabel!, cw,
            h - this.tagBarH - this.gapTitle - this.titleH - this.gapDesc - this.ctaGapTop - this.ctaH - this.padBottom,
            -this.tagBarH - this.gapTitle - this.titleH - this.gapDesc);

        // CTA：面板底部居中
        if (this._ctaNode) {
            const cw2 = w - this.padH * 2;
            const ut = this._ctaNode.getComponent(UITransform);
            if (ut) ut.setContentSize(cw2, this.ctaH);
            this._ctaNode.setPosition(0, -(h - this.padBottom - this.ctaH / 2), 0);
        }
    }

    private _setLabel(lb: Label, w: number, h: number, topY: number): void {
        const ut = lb.node.getComponent(UITransform) || lb.node.addComponent(UITransform);
        // 左上角锚点：文本从顶边向下展开；内容增高时只向下增长，
        // 不会像居中锚点那样向上溢出、覆盖上方区域甚至突破气泡边界。
        ut.anchorX = 0;
        ut.anchorY = 1;
        ut.setContentSize(w, h);
        lb.verticalAlign = Label.VerticalAlign.TOP;
        lb.horizontalAlign = Label.HorizontalAlign.LEFT;
        lb.node.setPosition(-w / 2, topY, 0);   // x 取 -w/2 → 文本左缘对齐左内边距
    }

    // ==================== 动画 ====================

    private _animateOpen(): void {
        this.node.setScale(1, 0, 1);
        this._tagLabel!.node.active = false;
        this._titleLabel!.node.active = false;
        this._descLabel!.node.active = false;
        if (this._ctaNode) this._ctaNode.active = false;

        tween(this.node).to(this.animOpenDur, { scale: new Vec3(1, 1, 1) }, { easing: 'sineOut' }).start();

        this.scheduleOnce(() => {
            this._tagLabel!.node.active = true;
            this._titleLabel!.node.active = true;
            this._descLabel!.node.active = true;
            if (this._ctaNode) this._ctaNode.active = true;
            const fadeNodes: Node[] = [this._tagLabel!.node, this._titleLabel!.node, this._descLabel!.node];
            if (this._ctaNode?.isValid) fadeNodes.push(this._ctaNode);
            for (const nd of fadeNodes) {
                const op = nd.getComponent(UIOpacity) || nd.addComponent(UIOpacity);
                op.opacity = 0;
                tween(op).to(this.animFadeDur, { opacity: 255 }, { easing: 'sineOut' }).start();
            }
        }, this.animTextDelay);
    }
}
