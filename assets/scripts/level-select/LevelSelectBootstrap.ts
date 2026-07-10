/**
 * LevelSelectBootstrap.ts — 关卡选择场景入口（测试版本）
 *
 * =========================================================
 * ⚠️ 测试代码：阶段 4 验收脚本。
 *    验收通过后 onLoad 中的测试逻辑会被注释，保留数据加载框架。
 * =========================================================
 *
 * 挂载：Canvas 节点上。
 */

import { _decorator, Component, Node, Button, Graphics, Color, resources, JsonAsset, UITransform, EventTouch, Vec3, AudioClip, input, Input, KeyCode, Sprite, director, Label, UIOpacity, tween, view, ResolutionPolicy, Widget } from 'cc';
import { LevelDataManager, ChapterMeta } from '../core/LevelDataManager';
import { LevelNode, LevelStatus } from './LevelNode';
import { BubblePopup } from './BubblePopup';
import { SessionState } from '../core/SessionState';
import { AudioManager } from '../core/AudioManager';
import { CursorStyle } from '../ui-tools/CursorStyle';
import { ChapterTransition } from './ChapterTransition';
import { OrbitParticles } from './OrbitParticles';
import { ScanSweep } from './ScanSweep';
import { ChapterBackground } from './ChapterBackground';
import { CoreEffect } from './CoreEffect';
import { ChapterDots, ChapterState } from './ChapterDots';
import { ChapterTitle } from './ChapterTitle';
import { Config } from '../core/Config';
import { FontManager } from '../core/FontManager';

const { ccclass, property } = _decorator;

// OrbitZone 尺寸 → 中心偏移（设计坐标：区域中心 = (960,360)）
const HW = 960;
const HH = 360;

// 设计坐标(zx,zy) → OrbitZone 局部坐标（原点即区域中心，与 CoreEffect.toLocal 一致）。
// 注意：OrbitZone 局部原点是区域中心，不是设计坐标左上角；子节点若直接写 (960,360)
// 会被推到屏幕右上方导致严重偏移，必须经此换算。
function toLocal(zx: number, zy: number): { x: number; y: number } {
    return { x: zx - HW, y: zy - HH };
}

@ccclass('LevelSelectBootstrap')
export class LevelSelectBootstrap extends Component {

    private _levelNodes: LevelNode[] = [];
    private _popup: BubblePopup | null = null;
    private _transition: ChapterTransition | null = null;
    private _scanSweep: ScanSweep | null = null;
    private _selectedIndex: number = -1;
    private _entering: boolean = false;
    private _currentChapter: number = 0; // 0-3
    private _orbitZone: Node | null = null;
    private _background: ChapterBackground | null = null;
    private _coreEffect: CoreEffect | null = null;
    private _chapterDots: ChapterDots | null = null;
    private _chapterTitle: ChapterTitle | null = null;   // 章节主副标题（独立组件，见 ChapterTitle.ts）

    // ==================== 音效（编辑器拖入 AudioClip） ====================

    @property({ type: AudioClip, tooltip: '节点点击/选中音效' })
    sfxSelect: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: '弹窗展开音效' })
    sfxPopupOpen: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: '弹窗关闭音效' })
    sfxPopupClose: AudioClip | null = null;

    // ==================== 生命周期 ====================

    async onLoad(): Promise<void> {
        // 确保整块 1920×1080 设计画布在任意横屏宽高比下均完整可见（contain，无裁切），
        // 否则 fill/crop 策略会把顶部/底部的 HUD（如返回按钮、底部圆点）裁掉。
        view.setResolutionPolicy(ResolutionPolicy.SHOW_ALL);

        // ============================================
        // 测试代码开始（验收后注释此段）
        // ============================================

        await LevelDataManager.instance.load();

        // Config: 启动时自动加载进度预设
        if (Config.BOOT_PRESET > 0) {
            this._applyDebugPreset(Config.BOOT_PRESET);
        }

        const layout = await this._loadLayout();
        if (!layout) return;

        this._orbitZone = this._getNode('ContentArea/OrbitZone');
        this._setupBackground();
        this._createAllNodes(layout.nodePositions);

        // 点击 OrbitZone 空白区域 → 关闭弹窗
        if (this._orbitZone) {
            this._orbitZone.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
                // 只在直接点击 OrbitZone 上（非子节点）时触发
                if (e.target === this._orbitZone) {
                    this._closePopup();
                }
            });
        }

        const ch = LevelDataManager.instance.getChapterByIndex(0)!;
        for (let i = 0; i < 12; i++) {
            this._levelNodes[i].status = LevelDataManager.instance.getLevelStatus(ch.levels[i].globalId);
            this._levelNodes[i].levelIndex = i + 1;
        }

        // 中心地球核心：确保 CoreEffect 真正挂到 Core 节点上（仅地球，无外部接口）。
        const coreNode = this._getNode('ContentArea/OrbitZone/Core');
        if (coreNode) {
            if (!coreNode.getComponent(CoreEffect)) coreNode.addComponent(CoreEffect);   // 运行时挂上，触发 onLoad
            this._coreEffect = coreNode.getComponent(CoreEffect);   // 缓存引用，进关卡转场时驱动其淡出
            for (const comp of coreNode.getComponents(Component)) {
                const cn = comp.constructor.name;
                if (cn !== 'CoreEffect' && cn !== 'UITransform' && cn !== 'Graphics') {
                    comp.enabled = false;
                }
            }
        }

        // 章节标题（顶栏：主=第X章 / 副=章名）+ 圆点导航 + 返回主菜单按钮
        this._setupChapterTitle();
        this._setupChapterDots();
        this._setupBackButton();
        this._refreshChapterLabels(ch, 0);

        // 统一全局字体为 Orbitron（建完所有 Label 后套用）
        await FontManager.use(this.node);

        if (Config.DEBUG) console.log('[TEST] LevelSelectBootstrap 就绪，12 节点 + BubblePopup 模式');

        // 初始背景
        this._background?.switchTo(0);

        // 6. 创建动态节点 + 章节过渡控制器 + 键盘测试
        this._setupTransitionAndTest();

        // ============================================
        // 测试代码结束
        // ============================================
    }

    // ==================== 数据加载 ====================

    private _loadLayout(): Promise<any> {
        return new Promise((resolve) => {
            resources.load('configs/levels/level-select-layout', JsonAsset, (err, asset) => {
                if (err) { console.error('[Bootstrap] layout.json 加载失败:', err); resolve(null); return; }
                resolve(asset.json);
            });
        });
    }

    // ==================== 节点创建 ====================

    private _createAllNodes(positions: Array<{ x: number; y: number }>): void {
        const pool = this._getNode('ContentArea/OrbitZone/LevelNodePool');
        if (!pool) return;

        for (let i = 0; i < positions.length; i++) {
            const { x, y } = positions[i];
            const node = new Node(`LevelNode_${i + 1}`);
            node.parent = pool;
            node.layer = pool.layer;

            node.addComponent(UITransform).setContentSize(56, 56);
            node.addComponent(Graphics);

            const btn = node.addComponent(Button);
            const idx = i;
            btn.node.on(Button.EventType.CLICK, () => this._onNodeClick(idx));

            const ln = node.addComponent(LevelNode);
            ln.status = LevelStatus.LOCKED;
            node.addComponent(CursorStyle).cursorType = 'pointer';
            node.setPosition(x - HW, y - HH, 0);
            this._levelNodes.push(ln);
        }
    }

    // ==================== 背景图 ====================

    private _setupBackground(): void {
        const content = this._getNode('ContentArea');
        if (!content) return;

        const bgNode = new Node('ChapterBackground');
        bgNode.parent = content;
        bgNode.layer = content.layer;
        bgNode.setSiblingIndex(0);

        bgNode.addComponent(UITransform).setContentSize(1920, 1080);
        bgNode.addComponent(Sprite);
        this._background = bgNode.addComponent(ChapterBackground);
    }

    // ==================== 章名（顶栏）+ 编号（底栏）+ 圆点导航 ====================

    /**
     * 章节标题（顶栏）：主副标题结构。
     *   - 主标题 = 第 X 章（短、稳定，作结构锚点，信号绿）
     *   - 副标题 = 章名（来自 chapters.json，可能较长，灰白，可换行）
     * 设计取舍：章名通常较长，放副标题不易破版；若想反转（主=章名 / 副=第X章），
     * 只需交换两 Label 的 fontSize 与下方 _refreshChapterLabels 里的赋值即可。
     */
    private _setupChapterTitle(): void {
        // 章节主副标题抽为独立组件 ChapterTitle（见 ChapterTitle.ts）。本方法只负责
        // 场景落位 + 装配；内部布局（字号/颜色/间距）由组件 @property 持有。
        // 局部原点 = 屏幕中心、+y=上；落在「轨道底部」与「dots 行」之间用负值。
        const node = new Node('ChapterTitle');
        node.parent = this._orbitZone ?? this.node;
        node.layer = (this._orbitZone ?? this.node).layer;
        node.setPosition(0, -280, 0);   // 介于 orbitzone 与 dots 之间（用户定 -300）
        this._chapterTitle = node.addComponent(ChapterTitle);
    }

    private _setupChapterDots(): void {
        if (!this._orbitZone) return;
        const node = new Node('ChapterDots');
        node.parent = this._orbitZone;
        node.layer = this._orbitZone.layer;
        const c = toLocal(960, 360); // 区域中心 = 局部 (0,0)；圆点行由 rowY 向下偏移
        node.setPosition(c.x, c.y, 0);
        this._chapterDots = node.addComponent(ChapterDots); // rowY 等视觉布局由 ChapterDots 的 @property 持有（单一职责），Bootstrap 只负责场景落位与数据装配
        this._chapterDots.onSelect = (i) => this._switchChapter(i);
        this._chapterDots.onSelectLocked = (_i, pos) => this._showLockedHint(pos);
        this._refreshDots();
    }

    /**
     * 返回主菜单按钮：用 Widget 钉在 Canvas 右上角（屏幕对齐），任意横屏宽高比都贴角可见；
     * 面板底色明显区别于场景背景(#1A1A1A)，加粗亮绿描边 + 明绿文字，避免被背景吞掉；
     * Button 缩放过渡提供按下反馈。点击跳回 main-menu.scene。
     */
    private _setupBackButton(): void {
        // 外层定位节点：挂载 Widget（钉右上角）+ Button + CursorStyle，自身不参与缩放，保持定位稳定
        const node = new Node('BackButton');
        node.parent = this.node;                 // Canvas
        node.layer = this.node.layer;
        const nodeUt = node.addComponent(UITransform);
        nodeUt.setContentSize(176, 48);
        nodeUt.setAnchorPoint(0.5, 0.5);         // 显式中点锚点：Widget 定位与按钮中心一致

        // 内层视觉节点：承载 Graphics 圆角面板 + 文字，居中绘制；作为 Button 的缩放目标。
        // SCALE 过渡严格围绕 body 内容中心进行，与 Widget 定位层解耦，避免缩放原点偏移到一角。
        const body = new Node('BackButtonBody');
        body.parent = node; body.layer = node.layer;
        body.addComponent(UITransform).setContentSize(176, 48);
        const g = body.addComponent(Graphics);
        // 明显高于场景底色的面板 + 醒目绿边，确保不被背景吞掉
        g.fillColor = new Color(24, 30, 20, 235);
        g.roundRect(-88, -24, 176, 48, 10); g.fill();
        g.strokeColor = new Color(158, 255, 0, 255); g.lineWidth = 2.5;
        g.roundRect(-88, -24, 176, 48, 10); g.stroke();
        // 顶部细高光，强化"可点"观感
        g.strokeColor = new Color(158, 255, 0, 55); g.lineWidth = 1;
        g.roundRect(-83, -19, 166, 38, 8); g.stroke();

        const lbl = new Node('BackLabel');
        lbl.parent = body; lbl.layer = node.layer;
        lbl.addComponent(UITransform).setContentSize(176, 48);
        const l = lbl.addComponent(Label);
        l.string = '← 主菜单';
        l.fontSize = 20; l.color = new Color(205, 255, 130);
        FontManager.attachCJK(l);
        l.horizontalAlign = Label.HorizontalAlign.CENTER;
        l.verticalAlign = Label.VerticalAlign.CENTER;

        const btn = node.addComponent(Button);
        btn.transition = Button.Transition.SCALE;   // 按下缩放反馈（谏言 #3）
        btn.zoomScale = 0.92;
        btn.duration = 0.12;
        btn.target = body;                          // 缩放目标 = 视觉节点（围绕内容中心，非定位节点）
        btn.node.on(Button.EventType.CLICK, () => {
            console.log('[Bootstrap] 返回主菜单');
            director.loadScene('main-menu');
        });
        node.addComponent(CursorStyle).cursorType = 'pointer';

        // Widget 钉右上角：屏幕对齐，横屏任意宽高比都贴角可见（修复"位置错误/被裁切"）
        const w = node.addComponent(Widget);
        w.isAlignTop = true; w.isAlignRight = true;
        w.top = 36; w.right = 36;
        w.alignMode = Widget.AlignMode.ALWAYS;
    }

    private _refreshChapterLabels(ch: ChapterMeta | null, chapterIndex?: number, fade: boolean = false): void {
        const idx = chapterIndex ?? this._currentChapter;
        // 主副标题交给 ChapterTitle 组件：主=第 X 章，副=章名（标签子节点首次调用时构建）
        if (!this._chapterTitle) return;
        // 切章时让标题跟着淡入淡出；首次 / 预设即时显示（无淡入）
        if (fade) this._chapterTitle.fadeTo(idx, ch?.name ?? '');
        else this._chapterTitle.setTitle(idx, ch?.name ?? '');
    }

    private _refreshDots(): void {
        if (!this._chapterDots) return;
        this._chapterDots.setChapters(this._computeChapterStates());
        this._chapterDots.setSelected(this._currentChapter);
    }

    /** 各章状态（数据驱动，与全局 THEME 三态色一致）：done/pending/locked */
    private _computeChapterStates(): ChapterState[] {
        const count = LevelDataManager.instance.getChapters().length;
        const states: ChapterState[] = [];
        for (let ci = 0; ci < count; ci++) {
            const ch = LevelDataManager.instance.getChapterByIndex(ci);
            if (!ch) { states.push('locked'); continue; }
            const done = ch.completedIds.length;
            const total = ch.levels.length;
            if (done >= total) states.push('done');
            else if (LevelDataManager.instance.isChapterAccessible(ci)) states.push('pending');
            else states.push('locked');
        }
        return states;
    }

    private _showLockedHint(pos: Vec3): void {
        const node = new Node('LockedHint');
        node.parent = this.node;
        node.layer = this.node.layer;
        // pos 是 dot 的世界坐标；必须用 setWorldPosition 落位，否则父节点一旦有变换，
        // 用 setPosition(世界坐标) 会把它错放到屏幕外 → 看不到提示。
        node.setWorldPosition(new Vec3(pos.x, pos.y + 30, pos.z));
        if (node.parent) node.setSiblingIndex(node.parent.children.length - 1); // 置顶，避免被轨道/地球图层遮挡
        node.addComponent(UITransform).setContentSize(220, 30);
        const lbl = node.addComponent(Label);
        lbl.string = '需先通关前一章';
        lbl.fontSize = 14;
        lbl.color = new Color(255, 158, 61);
        FontManager.attachCJK(lbl);
        lbl.horizontalAlign = Label.HorizontalAlign.CENTER;
        lbl.verticalAlign = Label.VerticalAlign.CENTER;
        const op = node.addComponent(UIOpacity);
        op.opacity = 255;
        this.scheduleOnce(() => { if (node.isValid) node.destroy(); }, 1300);
        tween(op).delay(0.9).to(0.4, { opacity: 0 }).start();
    }

    // ==================== 中心锚点（地球） ====================
    // 进度环与函数勋章的环上版已于 2026-07-09 移除；全局进度由 ChapterDots + 关卡节点承载，
    // 函数勋章现绘制于 ChapterDots 的已通关圆点上。CoreEffect 仅挂载、无外部接口调用。

    /**
     * 进入选中关卡：
     *   1. 点击即刻并行预加载 game 场景（不阻塞交互，待转场与预加载都完成再跳转）；
     *   2. 播扫描线转场，期间随扫描线让所有前景组件（关卡节点、章节圆点、章名、背景）淡出；
     *   3. 等组件全部淡出且 game 场景预加载完成后，再跳转到 game.scene（避免黑屏/卡顿）。
     * 已通关关亦可重玩（status 为 CHALLENGEABLE 或 COMPLETE 均放行）。
     */
    private async _enterSelectedLevelWithScan(): Promise<void> {
        if (this._entering) return;          // 防止扫描期间重复点击
        if (this._selectedIndex < 0) return;
        const ch = LevelDataManager.instance.getChapterByIndex(this._currentChapter);
        if (!ch) return;
        const level = ch.levels[this._selectedIndex];
        if (!level) return;
        const status = LevelDataManager.instance.getLevelStatus(level.globalId);
        if (status === LevelStatus.LOCKED) return; // 仅放行 可挑战 / 已通关

        this._entering = true;
        if (this._transition) this._transition.isTransitioning = true;   // 阻止键盘切章等并发过渡
        SessionState.instance.selectedLevelId = level.globalId;
        console.log(`[Bootstrap] 进入关卡 Lv.${level.globalId} (status=${status})`);

        // 1) 点击即刻并行预加载 game 场景
        let preloadDone = false;
        const preloadTask = new Promise<void>(resolve => {
            director.preloadScene('game', () => { preloadDone = true; resolve(); });
        });

        // 2) 先收起详情弹窗（切场景即销毁，不等待其收起动画）
        this._closePopup();

        // 3) 章名在扫描线扫过时淡出（随扫描节奏，保留当前文字）
        let titleSwapped = false;
        const titleY = this._chapterTitle ? this._chapterTitle.node.position.y : -280;
        if (this._transition) {
            this._transition.onScanProgress = (y: number) => {
                if (!titleSwapped && y <= titleY) {
                    titleSwapped = true;
                    this._chapterTitle?.fadeOutOnly();
                }
            };
        }

        // 4) 扩大扫描 + 擦除范围到整屏高度（不影响切章默认的 720 区域）
        const tr = this._transition;
        const sweep = this._scanSweep;
        const prevTrZoneH = tr ? tr.zoneH : 720;
        const prevSweepZoneH = sweep ? sweep.zoneH : 1080;
        if (tr) tr.zoneH = 1080;
        if (sweep) sweep.zoneH = 1080;

        // 5) 扫描线转场：擦除关卡节点 + 章名 + 章节圆点 + 地球 + 背景，随扫描一并淡出。
        //    进关卡时整个场景即将销毁，故这些组件一并淡出（切章时圆点/地球恒定、不受影响）。
        const dur = tr ? tr.wipeDur + tr.fadeDur : 0.6;   // 与 wipeOut 总时长严格对齐
        const bgTask = this._background ? this._background.fadeOut(0.6) : null;
        const coreTask = this._coreEffect ? new Promise<void>(resolve => {
            tween(this._coreEffect).to(dur, { transitionAlpha: 0 }).call(() => resolve()).start();
        }) : null;
        const dotsTask = this._chapterDots ? new Promise<void>(resolve => {
            tween(this._chapterDots).to(dur, { transitionAlpha: 0 }).call(() => resolve()).start();
        }) : null;
        if (tr) {
            await tr.wipeOut();
        } else {
            await new Promise<void>(r => this.scheduleOnce(() => r(), 0.6));
        }
        if (bgTask) await bgTask;
        if (coreTask) await coreTask;
        if (dotsTask) await dotsTask;

        // 6) 恢复扫描范围（场景即将销毁，仅保持代码整洁）
        if (tr) tr.zoneH = prevTrZoneH;
        if (sweep) sweep.zoneH = prevSweepZoneH;

        // 7) 等 game 场景预加载完成，再跳转（避免黑屏/卡顿）
        if (!preloadDone) await preloadTask;

        director.loadScene('game');
    }

    // ==================== DEBUG 进度预设（验收后删除） ====================

    private _applyDebugPreset(count: number): void {
        if (!Config.DEBUG) return;
        const mgr = LevelDataManager.instance;
        console.log(`[DEBUG] 预设进度: ${count} / 48 关`);

        for (let ci = 0; ci < 4; ci++) {
            const chData = LevelDataManager.instance.getChapterByIndex(ci);
            if (!chData) continue;
            chData.completedIds.length = 0;
            const base = ci * 12 + 1;
            for (let gid = base; gid < base + 12 && gid <= count; gid++) {
                chData.completedIds.push(gid);
            }
        }

        LevelDataManager.instance.saveProgress();

        const ch = LevelDataManager.instance.getChapterByIndex(this._currentChapter);
        if (ch) {
            const n = Math.min(this._levelNodes.length, ch.levels.length);
            for (let i = 0; i < n; i++) {
                this._levelNodes[i].status = LevelDataManager.instance.getLevelStatus(ch.levels[i].globalId);
                this._levelNodes[i].levelIndex = ch.levels[i].globalId;
            }
        }

        if (this._selectedIndex >= 0) {
            this._levelNodes[this._selectedIndex].selected = false;
            this._selectedIndex = -1;
        }
        if (ch) {
            for (let i = 0; i < Math.min(this._levelNodes.length, ch.levels.length); i++) {
                if (this._levelNodes[i].status === LevelStatus.CHALLENGEABLE) {
                    this._levelNodes[i].selected = true;
                    this._selectedIndex = i;
                    break;
                }
            }
        }

        // 圆点 + 章名同步（预设可能解锁新章 / 让整章全通）
        this._refreshChapterLabels(ch, this._currentChapter);
        this._refreshDots();
    }

    private _setupTransitionAndTest(): void {
        if (!this._orbitZone) return;

        let pNode = this._orbitZone.getChildByName('OrbitParticles');
        if (!pNode) {
            pNode = new Node('OrbitParticles');
            pNode.parent = this._orbitZone;
            pNode.layer = this._orbitZone.layer;
            pNode.addComponent(Graphics);
            pNode.addComponent(OrbitParticles);
        }

        let sNode = this._orbitZone.getChildByName('ScanSweep');
        if (!sNode) {
            sNode = new Node('ScanSweep');
            sNode.parent = this._orbitZone;
            sNode.layer = this._orbitZone.layer;
            sNode.addComponent(Graphics);
            sNode.addComponent(ScanSweep);
        }
        this._scanSweep = sNode.getComponent(ScanSweep) ?? null;

        this._transition = this._orbitZone.getComponent(ChapterTransition) || this._orbitZone.addComponent(ChapterTransition);
        this._transition.levelNodes = this._levelNodes;
        // 注意：章节圆点 ChapterDots 是控制级 UI（导航盘），在切章时恒定不淡出，故不注册进转场擦除。

        input.on(Input.EventType.KEY_DOWN, (e: any) => {
            if (this._transition?.isTransitioning) {
                if (Config.DEBUG) console.log('[TEST] 过渡中，忽略输入');
                return;
            }
            if (e.keyCode === KeyCode.ARROW_RIGHT && this._currentChapter < 3) {
                if (Config.DEBUG) console.log(`[TEST] → 切换到第 ${this._currentChapter + 2} 章`);
                this._switchChapter(this._currentChapter + 1);
            } else if (e.keyCode === KeyCode.ARROW_LEFT && this._currentChapter > 0) {
                if (Config.DEBUG) console.log(`[TEST] ← 切换到第 ${this._currentChapter} 章`);
                this._switchChapter(this._currentChapter - 1);
            } else if (Config.DEBUG) {
                if      (e.keyCode === KeyCode.DIGIT_0) { this._applyDebugPreset(0);  }
                else if (e.keyCode === KeyCode.DIGIT_1) { this._applyDebugPreset(6);  }
                else if (e.keyCode === KeyCode.DIGIT_2) { this._applyDebugPreset(12); }
                else if (e.keyCode === KeyCode.DIGIT_3) { this._applyDebugPreset(18); }
                else if (e.keyCode === KeyCode.DIGIT_4) { this._applyDebugPreset(24); }
                else if (e.keyCode === KeyCode.DIGIT_5) { this._applyDebugPreset(30); }
                else if (e.keyCode === KeyCode.DIGIT_6) { this._applyDebugPreset(36); }
                else if (e.keyCode === KeyCode.DIGIT_7) { this._applyDebugPreset(42); }
                else if (e.keyCode === KeyCode.DIGIT_8) { this._applyDebugPreset(48); }
            }
        });

        if (Config.DEBUG) console.log('[TEST] 章节过渡就绪，按 ← → 测试切换');
    }

    private async _switchChapter(targetIndex: number): Promise<void> {
        if (this._transition?.isTransitioning) return;
        if (Config.DEBUG) console.log(`[TEST] 切换到第 ${targetIndex + 1} 章`);
        this._closePopup();

        // 立即响应圆点选中（不等扫描动画播完，避免"延迟大、感官差"）
        this._chapterDots?.setSelected(targetIndex);

        // 章名不立即过渡：等扫描线落下来时（onScanProgress 回调）才淡出 + 换字，
        // 数据更新后（bootup 完成）再淡入 —— 配合扫描节奏，而非独立过渡。
        const targetCh = LevelDataManager.instance.getChapterByIndex(targetIndex) ?? null;
        const titleLocalY = this._chapterTitle ? this._chapterTitle.node.position.y : -280;
        let titleSwapped = false;
        if (this._transition) {
            this._transition.onScanProgress = (y: number) => {
                if (!titleSwapped && y <= titleLocalY) {
                    titleSwapped = true;
                    this._chapterTitle?.syncFadeOut(targetIndex, targetCh?.name ?? '');
                }
            };
        }

        // 清空旧选中
        if (this._selectedIndex >= 0) {
            this._levelNodes[this._selectedIndex].selected = false;
            this._selectedIndex = -1;
        }

        this._transition!.isTransitioning = true;

        // 背景图交叉淡入淡出（与擦除并行）
        const bgTask = this._background?.switchTo(targetIndex);

        await this._transition!.wipeOut();

        const ch = LevelDataManager.instance.getChapterByIndex(targetIndex);
        if (ch) {
            const count = Math.min(this._levelNodes.length, ch.levels.length);
            for (let i = 0; i < count; i++) {
                this._levelNodes[i].status = LevelDataManager.instance.getLevelStatus(ch.levels[i].globalId);
                this._levelNodes[i].levelIndex = ch.levels[i].globalId;
            }

            for (let i = 0; i < count; i++) {
                if (this._levelNodes[i].status === LevelStatus.CHALLENGEABLE) {
                    this._levelNodes[i].selected = true;
                    this._selectedIndex = i;
                    break;
                }
            }
        }
        this._currentChapter = targetIndex;
        SessionState.instance.currentChapterIndex = targetIndex;

        await this._transition!.bootup();
        // 章名在节点淡入就位后浮现（配合扫描节奏：扫描落定 → 数据更新 → 标题浮现）
        this._chapterTitle?.syncFadeIn();
        this._transition!.isTransitioning = false;

        if (bgTask) await bgTask;

        // 章名编号已在切换开始时即时更新；圆点状态在进度变化时由 _refreshDots 同步
        if (Config.DEBUG) console.log(`[TEST] 第 ${targetIndex + 1} 章切换完成`);
    }

    private _onNodeClick(index: number): void {
        if (this.sfxSelect) AudioManager.instance.playSfx(this.sfxSelect);

        if (this._selectedIndex >= 0 && this._selectedIndex !== index) {
            this._levelNodes[this._selectedIndex].selected = false;
        }
        this._selectedIndex = index;
        this._levelNodes[index].selected = true;

        const ch = LevelDataManager.instance.getChapterByIndex(this._currentChapter);
        if (!ch || !this._orbitZone) return;

        const level = ch.levels[index];
        const targetNode = this._levelNodes[index].node;

        const targetPos = targetNode.position.clone();

        const status = LevelDataManager.instance.getLevelStatus(level.globalId);
        const built = level.completed === true;                 // 作者是否已制作该关（静态标志）
        const enterable = built && status !== LevelStatus.LOCKED; // 已制作且已解锁才可进入
        this._showPopup(targetPos, level.name, level.description, {
            enterable,
            completed: built,
            replay: status === LevelStatus.COMPLETE,            // 玩家是否已通关（只读，不碰存档）
            targetNode,                                          // 实时节点引用：引导线逐帧跟随其浮动
            onEnter: () => this._enterSelectedLevelWithScan(),
        });
        SessionState.instance.selectedLevelId = level.globalId;
    }

    private async _showPopup(targetPos: Vec3, title: string, desc: string,
                             opts?: { enterable?: boolean; completed?: boolean; replay?: boolean; targetNode?: Node; onEnter?: () => void }): Promise<void> {
        if (this._popup) {
            if (this._popup.node?.isValid) this._popup.node.destroy();
            this._popup = null;
        }

        const popupNode = new Node('BubblePopup');
        popupNode.parent = this._orbitZone;
        popupNode.layer = this._orbitZone!.layer;

        this._popup = popupNode.addComponent(BubblePopup);
        this._popup.show(targetPos, title, desc, opts);
        if (this.sfxPopupOpen) AudioManager.instance.playSfx(this.sfxPopupOpen);

        // z 序说明：弹窗是 OrbitZone 最后添加的子节点 → 天然位于层级顶层，视觉上盖在轨道/关卡节点之上（正确，
        //   用户要求"弹窗显示优先级最高、不被 LevelNode 盖住"）。
        // 点击穿透：弹窗透明区可点中背后/相邻关卡节点，已由 BubblePopup 根节点"不持有 UITransform"实现
        //   （面板为 Graphics，无命中框；仅 CTA 子节点自带 UITransform+Button 可点）。故【不应】再把 LevelNodePool
        //   提到弹窗之上——那会让关卡节点在视觉上压住弹窗（用户已反馈此问题）。二者无需 z 序权衡，各司其职。
    }

    private async _closePopup(): Promise<void> {
        if (this._popup) {
            if (this.sfxPopupClose) AudioManager.instance.playSfx(this.sfxPopupClose);
            const p = this._popup;
            this._popup = null;
            await p.hide();
            if (p.node?.isValid) p.node.destroy();
        }
    }

    // ==================== 工具 ====================

    private _getNode(path: string): Node | null {
        const parts = path.split('/');
        let cur: Node | null = this.node;
        for (const name of parts) {
            cur = cur?.getChildByName(name) ?? null;
            if (!cur) break;
        }
        if (!cur) console.warn(`[Bootstrap] 节点不存在: ${path}`);
        return cur;
    }
}
