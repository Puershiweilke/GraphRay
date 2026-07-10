/**
 * SettingsPanel.ts
 * 设置面板 — Prefab 弹窗形式，挂到 Canvas 最顶层
 *
 * 职责：
 *   1. show/hide（tween 缩放 + 透明度动画）
 *   2. 标签页切换（AudioPage / AboutPage）
 *   3. 遮罩层点击关闭
 *
 * 可扩展性：
 *   新增标签页只需：在 _buildContent 中新建 Page 节点，在 TabBar 加一个 Tab 按钮，
 *   _switchTab 中加一个分支。无需改动任何已有代码。
 *
 * 视觉：
 *   纯 Graphics 绘制 — 深色面板 + 1px 荧光绿边框 — 与主菜单同一套视觉语言
 */

import { _decorator, Component, Node, Label, UITransform, Graphics, Color, tween, Vec3, UIOpacity, Button } from 'cc';
import { AudioPage } from './AudioPage';
import { AboutPage } from './AboutPage';

const { ccclass } = _decorator;

// ==================== 设计常量 ====================

const C = {
    PANEL_W: 800, PANEL_H: 460,
    HEADER_H: 56,
    TAB_W: 130, TAB_H: 44,
    TAB_UNDERLINE_H: 3,

    // 色彩
    MASK:       new Color(0, 0, 0, 160),
    BG:         new Color(30, 30, 30, 255),
    TAB_BG:     new Color(40, 40, 40, 255),
    BORDER:     new Color(158, 255, 0, 255),
    ACTIVE:     new Color(158, 255, 0, 255),
    INACTIVE:   new Color(136, 136, 136, 255),
    WHITE:      new Color(255, 255, 255, 255),
    CLOSE:      new Color(136, 136, 136, 255),
    CLOSE_H:    new Color(255, 68, 68, 255),
    LINE:       new Color(60, 60, 60, 255),
};

// ==================== 组件 ====================

@ccclass('SettingsPanel')
export class SettingsPanel extends Component {

    // 核心引用
    private _panel:         Node        = null!;
    private _audioPage:     Node        = null!;
    private _aboutPage:     Node        = null!;
    private _tabAudio:      Node        = null!;
    private _tabAbout:      Node        = null!;
    private _audioUL:       Graphics    = null!; // tab underline
    private _aboutUL:       Graphics    = null!;
    private _currentTab:    number      = 0;

    // ==================== 生命周期 ====================

    onLoad(): void {
        this._build();
    }

    // ==================== 公开 API ====================

    /** 弹出设置面板（带缩放 + 淡入动画） */
    show(): void {
        this.node.active = true;

        const panel = this._panel;
        panel.setScale(0.85, 0.85, 1);

        let op = panel.getComponent(UIOpacity);
        if (!op) op = panel.addComponent(UIOpacity);
        op.opacity = 0;

        tween(panel)
            .parallel(
                tween().to(0.22, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }),
                tween(op).to(0.22, { opacity: 255 }),
            )
            .start();
    }

    /** 关闭设置面板（带缩放 + 淡出动画） */
    hide(): void {
        const panel = this._panel;
        const op = panel.getComponent(UIOpacity)!;

        tween(panel)
            .parallel(
                tween().to(0.15, { scale: new Vec3(0.9, 0.9, 1) }),
                tween(op).to(0.15, { opacity: 0 }),
            )
            .call(() => { this.node.active = false; })
            .start();
    }

    // ==================== UI 构建 ====================

    private _build(): void {
        const root = this.node;
        // UITransform 已在外部 _setupSettingsPanel 中添加，此处不再重复添加

        // ------- 遮罩 -------
        const mask = _makeNode(root, 'Mask', 1920, 1080);
        mask.addComponent(Button); // 透传点击 + 拦截穿透
        const mg = mask.addComponent(Graphics);
        mg.fillColor = C.MASK;
        mg.rect(-960, -540, 1920, 1080);
        mg.fill();
        mask.on(Node.EventType.TOUCH_END, () => this.hide());

        // ------- 面板主体 -------
        this._panel = _makeNode(root, 'Panel', C.PANEL_W, C.PANEL_H);
        _drawPanelBg(this._panel);

        // 阻止点击穿透到遮罩
        this._panel.addComponent(Button);

        this._buildHeader();
        this._buildTabs();
        this._buildContent();

        // 默认选中第一个标签
        this._switchTo(0);

        // 初始隐藏
        this.node.active = false;
    }

    // ------ 标题栏 ------

    private _buildHeader(): void {
        const hdr = _makeNode(this._panel, 'Header', C.PANEL_W, C.HEADER_H);
        hdr.setPosition(0, (C.PANEL_H - C.HEADER_H) / 2);

        // 标题
        const title = _makeLabel(hdr, '设置', 24, C.WHITE, 200, C.HEADER_H);
        title.getComponent(Label)!.horizontalAlign = Label.HorizontalAlign.LEFT;
        title.setPosition(-C.PANEL_W / 2 + 40, 0);

        // 底部隔线
        _drawHLine(hdr, -C.PANEL_W / 2 + 24, C.PANEL_W / 2 - 24, -C.HEADER_H / 2, C.LINE);

        // × 关闭按钮
        const close = _makeBtn(hdr, '×', 44, 44, 20, C.CLOSE, C.CLOSE_H);
        close.setPosition(C.PANEL_W / 2 - 40, 0);
        close.on(Node.EventType.TOUCH_END, () => this.hide());
    }

    // ------ 标签栏 ------

    private _buildTabs(): void {
        const y = (C.PANEL_H - C.HEADER_H) / 2 - C.HEADER_H;
        const bar = _makeNode(this._panel, 'TabBar', C.PANEL_W, C.TAB_H);
        bar.setPosition(0, y);

        // 底色
        const bg = bar.addComponent(Graphics);
        bg.fillColor = C.TAB_BG;
        bg.rect(-C.PANEL_W / 2, -C.TAB_H / 2, C.PANEL_W, C.TAB_H);
        bg.fill();

        // 底部隔线
        _drawHLine(bar, -C.PANEL_W / 2 + 24, C.PANEL_W / 2 - 24, -C.TAB_H / 2, C.LINE);

        // 标签按钮 — 音频
        this._tabAudio = _makeTabBtn(bar, '音频与语言');
        this._tabAudio.setPosition(-85, 0);
        this._audioUL = _makeUnderline(this._tabAudio);
        this._tabAudio.on(Node.EventType.TOUCH_END, () => this._switchTo(0));

        // 标签按钮 — 关于
        this._tabAbout = _makeTabBtn(bar, '关于');
        this._tabAbout.setPosition(85, 0);
        this._aboutUL = _makeUnderline(this._tabAbout);
        this._tabAbout.on(Node.EventType.TOUCH_END, () => this._switchTo(1));
    }

    // ------ 内容区 ------

    private _buildContent(): void {
        const h = C.PANEL_H - C.HEADER_H - C.TAB_H;
        const y = (C.PANEL_H - C.HEADER_H) / 2 - C.HEADER_H - C.TAB_H;

        const area = _makeNode(this._panel, 'ContentArea', C.PANEL_W, h);
        area.setPosition(0, y - h / 2);

        this._audioPage = _makeNode(area, 'AudioPage', C.PANEL_W, h);
        this._audioPage.addComponent(AudioPage);

        this._aboutPage = _makeNode(area, 'AboutPage', C.PANEL_W, h);
        this._aboutPage.addComponent(AboutPage);
    }

    // ==================== 标签切换 ====================

    private _switchTo(i: number): void {
        this._currentTab = i;
        this._audioPage.active = i === 0;
        this._aboutPage.active = i === 1;

        _drawTabState(this._tabAudio, this._audioUL, i === 0);
        _drawTabState(this._tabAbout, this._aboutUL, i === 1);
    }
}

// ==================== 绘图工具 ====================

function _drawPanelBg(node: Node): void {
    const g = node.addComponent(Graphics);
    const [w, h] = [C.PANEL_W, C.PANEL_H];
    // 填充
    g.fillColor = C.BG;
    g.rect(-w / 2, -h / 2, w, h);
    g.fill();
    // 边框
    g.strokeColor = C.BORDER;
    g.lineWidth = 2;
    g.rect(-w / 2, -h / 2, w, h);
    g.stroke();
}

function _drawHLine(parent: Node, x1: number, x2: number, y: number, color: Color): void {
    const n = new Node('Line');
    n.addComponent(UITransform).setContentSize(Math.abs(x2 - x1), 1);
    n.setPosition((x1 + x2) / 2, y);
    const g = n.addComponent(Graphics);
    g.strokeColor = color;
    g.lineWidth = 1;
    g.moveTo(-Math.abs(x2 - x1) / 2, 0);
    g.lineTo(Math.abs(x2 - x1) / 2, 0);
    g.stroke();
    parent.addChild(n);
}

function _drawTabState(tab: Node, underline: Graphics, active: boolean): void {
    const label = tab.getComponentInChildren(Label)!;
    label.color = active ? C.ACTIVE : C.INACTIVE;

    underline.clear();
    if (active) {
        underline.fillColor = C.ACTIVE;
        underline.rect(-C.TAB_W / 2, -C.TAB_H / 2 + 2, C.TAB_W, C.TAB_UNDERLINE_H);
        underline.fill();
    }
}

// ==================== 节点工厂 ====================

function _makeNode(parent: Node, name: string, w: number, h: number): Node {
    const n = new Node(name);
    n.addComponent(UITransform).setContentSize(w, h);
    n.setPosition(0, 0, 0);
    parent.addChild(n);
    return n;
}

function _makeLabel(parent: Node, text: string, fontSize: number,
                    color: Color, w = 0, h = 0): Node {
    const n = new Node('Label');
    n.addComponent(UITransform).setContentSize(w || fontSize * 8, h || fontSize * 1.5);
    const l = n.addComponent(Label);
    l.string = text;
    l.fontSize = fontSize;
    l.color = color;
    l.horizontalAlign = Label.HorizontalAlign.CENTER;
    l.verticalAlign   = Label.VerticalAlign.CENTER;
    parent.addChild(n);
    return n;
}

/** 带 hover 颜色切换的按钮（Label only，无 image） */
function _makeBtn(parent: Node, text: string, w: number, h: number,
                  fontSize: number, color: Color, hoverColor: Color): Node {
    const btn = _makeNode(parent, 'Btn', w, h);
    btn.addComponent(Button);
    const lbl = btn.addComponent(Label);
    lbl.string = text;
    lbl.fontSize = fontSize;
    lbl.color = color;
    lbl.horizontalAlign = Label.HorizontalAlign.CENTER;
    lbl.verticalAlign   = Label.VerticalAlign.CENTER;
    btn.on(Node.EventType.MOUSE_ENTER, () => { lbl.color = hoverColor; });
    btn.on(Node.EventType.MOUSE_LEAVE,  () => { lbl.color = color; });
    return btn;
}

function _makeTabBtn(parent: Node, text: string): Node {
    const tab = _makeNode(parent, 'Tab_' + text, C.TAB_W, C.TAB_H);
    tab.addComponent(Button);
    _makeLabel(tab, text, 18, C.INACTIVE, C.TAB_W, C.TAB_H);
    return tab;
}

function _makeUnderline(parent: Node): Graphics {
    const n = new Node('Underline');
    n.addComponent(UITransform).setContentSize(C.TAB_W, C.TAB_UNDERLINE_H);
    n.setPosition(0, -6);
    parent.addChild(n);
    return n.addComponent(Graphics);
}
