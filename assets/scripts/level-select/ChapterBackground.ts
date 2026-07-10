/**
 * ChapterBackground.ts — 章节背景图控制器
 *
 * 职责：加载 4 张章背景图 → Screen 混合模式（12% 不透明度）→ 切章时交叉淡入淡出。
 *
 * 挂载：ContentArea 下的 Sprite 节点（由 Bootstrap 动态创建）。
 * 用法：Bootstrap 调用 switchTo(chapterIndex)，返回 Promise，可与 ChapterTransition 并行。
 */

import { _decorator, Component, Sprite, SpriteFrame, resources, Color, tween, Tween } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('ChapterBackground')
export class ChapterBackground extends Component {

    @property({ tooltip: '淡出/淡入时长（秒）' })
    fadeDuration: number = 0.8;

    @property({ tooltip: '背景不透明度（0–255），设计值 12% = 31' })
    bgOpacity: number = 12;

    isSwitching: boolean = false;

    private _sprite: Sprite | null = null;
    private _cache: Map<number, SpriteFrame> = new Map();
    private _currentChapter: number = -1;

    /** 当前正在运行的淡入/淡出 tween（目标是一个 Color 对象，不是节点，
     *  故场景销毁时引擎不会自动停止它——必须在此处显式 stop，否则会在已销毁 Sprite 上写 color 触发 equals(null) 崩溃）。 */
    private _fadeTween: Tween | null = null;

    onLoad(): void {
        this._sprite = this.getComponent(Sprite) || this.addComponent(Sprite);
        this._sprite.srcBlendFactor = 1;   // BlendFactor.ONE
        this._sprite.dstBlendFactor = 3;   // BlendFactor.ONE_MINUS_SRC_COLOR
        this._sprite.color = new Color(255, 255, 255, 0); // 初始不可见
    }

    /**
     * 切换到指定章的背景图（0-index）。
     * 流程：当前淡出 → 加载纹理（缓存）→ 换图 → 淡入。
     * 首次调用时直接淡入（无淡出）。
     */
    async switchTo(chapterIndex: number): Promise<void> {
        if (this.isSwitching || chapterIndex === this._currentChapter) return;
        this.isSwitching = true;

        const sprite = this._sprite!;
        const chapterId = chapterIndex + 1;

        // Phase 1: 淡出当前背景（非首次）
        if (this._currentChapter >= 0) {
            await this._fade(sprite, this.bgOpacity, 0, this.fadeDuration);
        }

        // Phase 2: 加载纹理（缓存优先）
        let frame = this._cache.get(chapterIndex);
        if (!frame) {
            frame = await this._load(`textures/level-select/chapter-${chapterId}-bg`);
            if (frame) this._cache.set(chapterIndex, frame);
        }

        if (!frame) {
            console.warn(`[ChapterBG] 纹理加载失败: chapter-${chapterId}`);
            this.isSwitching = false;
            return;
        }

        sprite.spriteFrame = frame;
        this._currentChapter = chapterIndex;

        // Phase 3: 淡入
        await this._fade(sprite, 0, this.bgOpacity, this.fadeDuration);

        this.isSwitching = false;
    }

    /**
     * 立即淡出当前背景图（「进入关卡」整屏退出时用，配合扫描线把背景一起清掉）。
     * 直接把 Sprite.color.a 从当前值缓动到 0，不触发切章逻辑。
     */
    async fadeOut(duration: number = this.fadeDuration): Promise<void> {
        if (!this._sprite) return;
        if (this.isSwitching) this.isSwitching = false;   // 放弃可能进行中的切章淡入
        await this._fade(this._sprite, this._sprite.color.a, 0, duration);
    }

    // ==================== 内部 ====================

    /** tween Sprite.color.a 从 fromAlpha 到 toAlpha */
    private _fade(sprite: Sprite, fromAlpha: number, toAlpha: number, duration: number): Promise<void> {
        return new Promise(resolve => {
            const c = new Color(255, 255, 255, fromAlpha);
            sprite.color = c;

            // 先停掉可能进行中的上一个 fade（例如切章淡入途中又调用 fadeOut），避免两个 tween 同时写 color 打架
            if (this._fadeTween) { this._fadeTween.stop(); this._fadeTween = null; }

            this._fadeTween = tween(c)
                .to(duration, { a: toAlpha }, {
                    // 防御：场景切换 / 节点销毁过程中 Sprite 可能已失效（_color 变 null），
                    // 此时再写 sprite.color 会触发引擎内部 this._color.equals(value) 在 null 上的崩溃。
                    // 校验存活再写，并让 tween 自然结束（resolve 在 call 里触发）。
                    onUpdate: () => {
                        if (!sprite || !sprite.isValid) return;
                        sprite.color = c;
                    },
                })
                .call(() => { this._fadeTween = null; resolve(); })
                .start();
        });
    }

    /** resources.load SpriteFrame（子资源路径需加 /spriteFrame） */
    private _load(path: string): Promise<SpriteFrame | null> {
        const fullPath = `${path}/spriteFrame`;
        return new Promise(resolve => {
            resources.load(fullPath, SpriteFrame, (err, sf) => {
                if (err) { console.warn(`[ChapterBG] 加载失败: ${fullPath}`, err); resolve(null); return; }
                console.log(`[ChapterBG] 纹理加载成功: ${fullPath}`);
                resolve(sf as SpriteFrame);
            });
        });
    }

    /**
     * 节点销毁时：停掉仍可能运行中的 fade tween（其目标是一个 Color 对象而非节点，
     * 引擎不会随节点销毁自动回收）。否则场景切换瞬间若 fade 正进行，会在已销毁 Sprite 上
     * 持续写 color，触发 `Cannot read properties of null (reading 'equals')`。
     */
    onDestroy(): void {
        if (this._fadeTween) { this._fadeTween.stop(); this._fadeTween = null; }
    }
}
