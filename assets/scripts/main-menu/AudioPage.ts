/**
 * AudioPage.ts
 * 设置面板 — 音频与语言页
 *
 * 职责：
 *   1. BGM / SFX 音量滑块（点击或拖拽调整）
 *   2. 语言切换（中文 / English，预留）
 *   3. 首次进入自动检测系统语言
 *
 * 依赖：
 *   SettingsManager（读取/写入音量）
 *   AudioManager（绑定 BGM 音量）
 *   sys.language（系统语言检测）
 */

import { _decorator, Component, Node, Label, UITransform, Graphics, Color, EventTouch, sys, Vec3, Button } from 'cc';
import { SettingsManager } from '../core/SettingsManager';
import { AudioManager } from '../core/AudioManager';

const { ccclass } = _decorator;

// ==================== 设计常量 ====================

const C = {
    BAR_W: 260,
    BAR_H: 10,
    ROW_GAP: 70,

    WHITE:   new Color(255, 255, 255, 255),
    GRAY:    new Color(136, 136, 136, 255),
    BAR_BG:  new Color(68, 68, 68, 255),
    FILL:    new Color(158, 255, 0, 255),
    ACTIVE:  new Color(158, 255, 0, 255),
    HANDLE:  new Color(158, 255, 0, 255),
};

// ==================== 组件 ====================

@ccclass('AudioPage')
export class AudioPage extends Component {

    // ==================== 生命周期 ====================

    onLoad(): void {
        this._build();
        this._initLanguage();
    }

    // ==================== UI 构建 ====================

    private _build(): void {
        const root = this.node;

        // Layout: centered vertically in the content area (360px)
        // BGM row  → y = 125
        // SFX row  → y = 60
        // Language → y = -5

        this._createVolRow(root, 'BGM 音量', 125,
            () => SettingsManager.bgmVolume.value,
            (v) => { AudioManager.instance.setBgmVolume(v); });

        this._createVolRow(root, '音效音量', 60,
            () => SettingsManager.sfxVolume.value,
            (v) => { AudioManager.instance.setSfxVolume(v); });

        this._createLangRow(root, -5);
    }

    // ------ 音量行 ------

    private _createVolRow(
        parent: Node, label: string, y: number,
        getVol: () => number, setVol: (v: number) => void,
    ): void {
        // 标签
        const lblNode = new Node('Label');
        lblNode.addComponent(UITransform).setContentSize(120, 30);
        lblNode.setPosition(-200, y);
        const lbl = lblNode.addComponent(Label);
        lbl.string = label;
        lbl.fontSize = 18;
        lbl.color = C.WHITE;
        lbl.horizontalAlign = Label.HorizontalAlign.LEFT;
        lbl.verticalAlign   = Label.VerticalAlign.CENTER;
        parent.addChild(lblNode);

        // 进度条背景
        const barNode = new Node('BarBg');
        barNode.addComponent(UITransform).setContentSize(C.BAR_W, C.BAR_H);
        barNode.setPosition(0, y);
        const barBg = barNode.addComponent(Graphics);
        barBg.fillColor = C.BAR_BG;
        barBg.roundRect(-C.BAR_W / 2, -C.BAR_H / 2, C.BAR_W, C.BAR_H, C.BAR_H / 2);
        barBg.fill();
        parent.addChild(barNode);

        // 填充层
        const fillNode = new Node('BarFill');
        fillNode.addComponent(UITransform).setContentSize(0, C.BAR_H);
        fillNode.setPosition(-C.BAR_W / 2, y);
        fillNode.getComponent(UITransform)!.setAnchorPoint(0, 0.5);
        const fillGfx = fillNode.addComponent(Graphics);
        parent.addChild(fillNode);

        // 百分比文本
        const valNode = new Node('Value');
        valNode.addComponent(UITransform).setContentSize(60, 30);
        valNode.setPosition(C.BAR_W / 2 + 40, y);
        const valLabel = valNode.addComponent(Label);
        valLabel.fontSize = 16;
        valLabel.color = C.GRAY;
        valLabel.horizontalAlign = Label.HorizontalAlign.RIGHT;
        valLabel.verticalAlign   = Label.VerticalAlign.CENTER;
        parent.addChild(valNode);

        // 绘制填充
        const redraw = () => {
            const vol = getVol();
            const w = Math.max(0, C.BAR_W * vol);
            fillNode.getComponent(UITransform)!.setContentSize(w, C.BAR_H);
            fillGfx.clear();
            fillGfx.fillColor = C.FILL;
            fillGfx.roundRect(0, -C.BAR_H / 2, w, C.BAR_H, C.BAR_H / 2);
            fillGfx.fill();
            valLabel.string = Math.round(vol * 100) + '%';
        };

        // 触摸交互
        let touching = false;

        const updateFromTouch = (evt: EventTouch) => {
            const uiPos = evt.getUILocation();
            const local = barNode.getComponent(UITransform)!
                .convertToNodeSpaceAR(new Vec3(uiPos.x, uiPos.y, 0));
            const ratio = (local.x + C.BAR_W / 2) / C.BAR_W;
            setVol(Math.max(0, Math.min(1, Math.round(ratio * 20) / 20))); // 5% 步进
            redraw();
        };

        barNode.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
            touching = true;
            updateFromTouch(e);
        });
        barNode.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
            if (touching) updateFromTouch(e);
        });
        barNode.on(Node.EventType.TOUCH_END, () => { touching = false; });
        barNode.on(Node.EventType.TOUCH_CANCEL, () => { touching = false; });

        // 初始渲染
        redraw();

        // 监听音量变化（外部调整时同步 UI）
        const item = label === 'BGM 音量'
            ? SettingsManager.bgmVolume
            : SettingsManager.sfxVolume;
        item.on(() => redraw(), this);
    }

    // ------ 语言行 ------

    private _lblZh: Label = null!;
    private _lblEn: Label = null!;

    private _createLangRow(parent: Node, y: number): void {
        // 标签
        const lblNode = new Node('Label');
        lblNode.addComponent(UITransform).setContentSize(80, 30);
        lblNode.setPosition(-200, y);
        const lbl = lblNode.addComponent(Label);
        lbl.string = '语言';
        lbl.fontSize = 18;
        lbl.color = C.WHITE;
        lbl.horizontalAlign = Label.HorizontalAlign.LEFT;
        lbl.verticalAlign   = Label.VerticalAlign.CENTER;
        parent.addChild(lblNode);

        // 中文按钮
        const zh = this._makeLangBtn(parent, '中文', -30, y);
        this._lblZh = zh.getComponent(Label)!;
        zh.on(Node.EventType.TOUCH_END, () => this._setLang('zh'));

        // English 按钮
        const en = this._makeLangBtn(parent, 'English', 90, y);
        this._lblEn = en.getComponent(Label)!;
        en.on(Node.EventType.TOUCH_END, () => this._setLang('en'));
    }

    private _makeLangBtn(parent: Node, text: string, x: number, y: number): Node {
        const n = new Node('LangBtn');
        n.addComponent(UITransform).setContentSize(100, 32);
        n.setPosition(x, y);
        n.addComponent(Button);
        const lbl = n.addComponent(Label);
        lbl.string = text;
        lbl.fontSize = 16;
        lbl.color = C.GRAY;
        lbl.horizontalAlign = Label.HorizontalAlign.CENTER;
        lbl.verticalAlign   = Label.VerticalAlign.CENTER;
        parent.addChild(n);
        return n;
    }

    // ==================== 语言逻辑 ====================

    private _lang: 'zh' | 'en' = 'zh';

    private _initLanguage(): void {
        // 优先用持久化值，无记录时自动检测系统语言
        const persisted = SettingsManager.language.value;
        const auto = (persisted && persisted !== null) ? persisted
            : sys.language.startsWith('zh') ? 'zh'
            : sys.language.startsWith('en') ? 'en'
            : 'zh';
        this._setLang(auto);
    }

    private _setLang(lang: 'zh' | 'en'): void {
        this._lang = lang;
        SettingsManager.language.value = lang;
        this._lblZh.color = lang === 'zh' ? C.ACTIVE : C.GRAY;
        this._lblEn.color = lang === 'en' ? C.ACTIVE : C.GRAY;
    }
}
