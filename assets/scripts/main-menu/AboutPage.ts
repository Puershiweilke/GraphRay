/**
 * AboutPage.ts
 * 设置面板 — 关于页
 *
 * 职责：纯展示，无交互。两栏布局，每栏 ≤6 行。
 *   左栏：开发者信息
 *   右栏：使用的资源及来源
 *   颜色：值行绿色，说明行灰色，标题白色
 */

import { _decorator, Component, Node, Label, UITransform, Color } from 'cc';
import { FontManager } from '../core/FontManager';

const { ccclass } = _decorator;

const WHITE = new Color(255, 255, 255, 255);
const GRAY  = new Color(153, 153, 153, 255);
const GREEN = new Color(158, 255, 0, 255);

// ==================== 布局常量 ====================

const LINE_W    = 340;
const LEFT_X    = -180;
const RIGHT_X   = 180;
const COL_TOP   = 120;
const ROW_H     = 32;
const GAP_S     = 10;
const GAP_M     = 16;
const INDENT    = 20;

// ==================== 组件 ====================

@ccclass('AboutPage')
export class AboutPage extends Component {

    onLoad(): void {
        this._build();
    }

    private _build(): void {
        const root = this.node;
        this._buildLeft(root);
        this._buildRight(root);
    }

    // ------ 左栏：开发者信息（4 行）------

    private _buildLeft(root: Node): void {
        let y = COL_TOP;

        addLine(root, LEFT_X,        y, '基本信息',               WHITE, 18); y -= ROW_H + GAP_M;
        addLine(root, LEFT_X,        y, '游戏版本：v1.0',           GREEN, 16); y -= ROW_H + GAP_M;
        addLine(root, LEFT_X,        y, '游戏开发者：puershiweike', GREEN, 16); y -= ROW_H + GAP_M;
        addLine(root, LEFT_X,        y, '个人网站：https://zzyhub.cn', GREEN, 14); y -= ROW_H + GAP_M;
        addLine(root, LEFT_X,        y, '微信：puershiweike',       GREEN, 16);
    }

    // ------ 右栏：资源与来源（6 行）------

    private _buildRight(root: Node): void {
        let y = COL_TOP;

        addLine(root, RIGHT_X,        y, '资源与来源',               WHITE, 18); y -= ROW_H + GAP_M;
        addLine(root, RIGHT_X,        y, 'BGM：neon_synthwave_drive', GREEN, 16); y -= ROW_H;
        addLine(root, RIGHT_X + INDENT, y, 'Pixabay (CC0)',           GRAY,  14); y -= ROW_H + GAP_M;
        addLine(root, RIGHT_X,        y, '引擎：Cocos Creator 3.8.8', GREEN, 16); y -= ROW_H + GAP_M;
        addLine(root, RIGHT_X,        y, '字体：Orbitron（拉丁）/ 系统默认（中文）', GREEN, 16); y -= ROW_H;
        addLine(root, RIGHT_X + INDENT, y, 'SIL Open Font License',   GRAY,  14);
    }
}

// ==================== 工具 ====================

function addLine(parent: Node, x: number, y: number,
                 text: string, color: Color, fontSize: number): void {
    const n = new Node('Line');
    n.addComponent(UITransform).setContentSize(LINE_W, ROW_H);
    n.setPosition(x, y);
    const l = n.addComponent(Label);
    l.string = text;
    l.fontSize = fontSize;
    // 仅标记字体类型，不立即套用：AboutPage 在 onLoad 期间建 Label，此时字体资源可能未就绪，
    // 直接 attach 会触发「资源未就绪」回退警告。套用交由 MainMenuBootstrap 的 FontManager.use(this.node) 统一完成。
    FontManager.markCJK(l);
    l.color = color;
    l.horizontalAlign = Label.HorizontalAlign.LEFT;
    l.verticalAlign   = Label.VerticalAlign.CENTER;
    parent.addChild(n);
}
