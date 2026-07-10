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

    /** 引导线线宽 */
    @property({ tooltip: '引导线线宽 (px)' })
    guideLW: number = 4;

    /** 拐角菱形半对角线长 */
    @property({ tooltip: '拐角菱形节点半径 (px)' })
    guideDiamond: number = 4;

    // 引导线终点 Y 由角括号几何结构推算（见 _drawGuideLine），不再暴露为可调参数。

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
        // 期望顶边大致对齐节点上沿
        const desiredTop = ty + this.nodeRadius;

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
        const px = this.node.position.x, py = this.node.position.y;
        // 面板 + 引导线共用同一 Graphics（_bgG）：同一坐标系（面板顶边中心为原点）+ 同一渲染通道，
        // 确保引导线一定可见（之前独立子节点 Graphics 因无 UITransform 未被 UI 渲染流纳入而整条不可见）。
        const g = this._bgG!; g.clear();
        this._drawPanel(g);
        this._drawGuideLine(g, this.targetPos.x - px, this.targetPos.y - py);
        this._updateLabels();
        this._drawCta();
    }

    private _drawPanel(g: Graphics): void {
        const w = this._pw, h = this._ph;
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
    }

    /**
     * 引导线：节点边缘 →（垂直）至角括号所在 Y →（水平）至角括号。Γ 形一笔画。
     * 三个顶点均由几何结构推算，不依赖魔法数字：
     *   A = 节点朝向面板一侧的边缘点 (srcX, srcY)
     *   B = 肘点：与节点同 X、角括号竖臂中点的 Y 处 (srcX, endY)（垂直段终点）
     *   C = 角括号竖臂中点 (edgeX, endY)（水平段终点），endY 由 cornerInset/cornerArm 推算
     * 拐角菱形画在肘点 B，强调 Γ 转折。
     * @param nodeCX/nodeCY 节点圆心在【气泡本地坐标系】中的坐标（由调用方传入：
     *   初始帧来自 targetPos 相对气泡的偏移；逐帧帧来自节点实时 worldPosition 经 inverseTransformPoint）。
     */
    private _drawGuideLine(g: Graphics, nodeCX: number, nodeCY: number): void {
        // 面板面对节点的那一侧边缘 X
        // _openRight=true → 面板在右 → 近侧是左边缘（-hw）
        const nearSign = this._openRight ? -1 : 1;
        const edgeX = nearSign * this._pw / 2;

        // 顶点 A：节点朝向面板的那一侧边缘
        const srcX = nodeCX - nearSign * this.nodeRadius;
        const srcY = nodeCY;

        // 顶点 B/C 的 Y：角括号竖臂中点（top=0，向下为负）
        const endY = -(this.cornerInset + this.cornerArm / 2);

        // Γ 形一笔画：A（节点边缘）→ B（垂直到角括号 Y）→ C（水平到角括号）
        g.strokeColor = this.colorGuide;
        g.lineWidth = this.guideLW;
        g.moveTo(srcX, srcY);       // A：节点边缘
        g.lineTo(srcX, endY);       // B：垂直段（肘点，与节点同 X）
        g.lineTo(edgeX, endY);      // C：水平段至角括号
        g.stroke();

        // 拐角菱形（画在肘点 B）
        const d = this.guideDiamond;
        g.fillColor = this.colorGuide;
        g.moveTo(srcX + d, endY);
        g.lineTo(srcX, endY + d);
        g.lineTo(srcX - d, endY);
        g.lineTo(srcX, endY - d);
        g.close();
        g.fill();
    }

    /**
     * 每帧：若正在显示且目标节点有效，读节点实时世界坐标 → 转气泡本地 → 重绘面板 + 引导线。
     * 引导线起点始终粘在关卡节点的浮动位置上，不再脱节。
     * 用 inverseTransformPoint（含气泡节点的缩放/位置逆变换），即便展开动画期间缩放 < 1 也能正确贴合。
     */
    update(dt: number): void {
        // 防御：场景切换 / 节点销毁过程中，本组件可能处于半销毁态，此时再写属性可能触发引擎内部
        // `this._field.equals(value)` 在 null 上的崩溃。先校验存活再绘制。
        if (!this._shown || !this.node.isValid) return;
        if (!this._targetNode || !this._targetNode.isValid) return;
        this.node.inverseTransformPoint(this._tmpV3, this._targetNode.worldPosition);
        // 引导线与面板共用 _bgG：整块重绘（面板 + 引导线）。Label/CTA 为独立子节点，不受此 clear 影响。
        const g = this._bgG!; g.clear();
        this._drawPanel(g);
        this._drawGuideLine(g, this._tmpV3.x, this._tmpV3.y);
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
