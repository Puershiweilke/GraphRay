/**
 * FontManager.ts — 全局字体管线（core 基础设施）
 *
 * 双字体策略，彻底不依赖系统字体（即便用户把系统字体换成花哨手写体，也不受影响）：
 *   · Latin  → Orbitron（拉丁专用，科幻观感），资源 fonts/Orbitron.ttf
 *   · CJK    → Noto Sans SC 子集（中文/符号/数学），资源 fonts/NotoSansSC-Subset.ttf
 *             子集由 tools/subset_cjk.py 生成（扫描项目全部中文+符号，可重复运行，
 *             自带 --check 覆盖校验）。详见该脚本头部注释。
 *
 * 两条路径都用 Cocos 原生「Font 资源」方案：resources.load 加载为 cc.Font，
 * 赋值 label.font（直接引用资源对象），不走 fontFamily 字符串查找 → 绝不回退系统字体。
 *
 * 用法：
 *   1) 场景 Bootstrap 的 onLoad（建完所有 Label 之后）：await FontManager.use(this.node);
 *   2) 运行时新建的 Label：
 *        - 纯拉丁/数字（如关卡编号）     → FontManager.attach(lbl);
 *        - 含中文/符号（章名/弹窗/文案） → FontManager.attachCJK(lbl);
 */

import { Node, Label, Font, resources } from 'cc';

type FontKind = 'latin' | 'cjk';

export class FontManager {
    /** 字体诊断日志开关（出包前设为 false）。 */
    static readonly DEBUG = true;

    /** 拉丁字体名（仅作 fontFamily 占位用，主路径是 label.font 资源引用）。 */
    static readonly GAME_FONT = 'Orbitron';
    /** 中文回退占位（资源未就绪时的短暂占位，加载完即被 CJKFont 替换）。 */
    static readonly CJK_FALLBACK = 'sans-serif';

    private static _latin: Font | null = null;   // Orbitron
    private static _cjk: Font | null = null;      // Noto Sans SC 子集
    private static _loading: Promise<void> | null = null;

    static get latinFont(): Font | null { return this._latin; }
    static get cjkFont(): Font | null { return this._cjk; }

    private static _log(...a: any[]): void {
        if (this.DEBUG) console.log('[FontManager]', ...a);
    }
    private static _warn(...a: any[]): void {
        if (this.DEBUG) console.warn('[FontManager]', ...a);
    }

    /** 并行加载 Orbitron + 中文子集（均本地 Font 资源）。只加载一次；失败安全放行。 */
    static ensureLoaded(): Promise<void> {
        if (this._latin && this._cjk) {
            this._log('ensureLoaded: 已就绪，跳过加载（latin=', this._latin?.name, 'cjk=', this._cjk?.name, '）');
            return Promise.resolve();
        }
        if (this._loading) {
            this._log('ensureLoaded: 复用进行中的加载 Promise');
            return this._loading;
        }

        this._log('ensureLoaded: 开始加载 → fonts/Orbitron + fonts/NotoSansSC-Subset');
        this._loading = new Promise<void>((resolve) => {
            let pending = 2;
            const done = () => { if (--pending <= 0) resolve(); };

            resources.load('fonts/Orbitron', Font, (err, asset) => {
                if (err || !asset) {
                    console.error('[FontManager] ❌ Orbitron 加载【失败】→ 拉丁字符将回退系统字体', err);
                } else {
                    this._latin = asset as Font;
                    this._log('✅ Orbitron 加载成功：', asset.name, '| isFont=', asset instanceof Font);
                }
                done();
            });
            resources.load('fonts/NotoSansSC-Subset', Font, (err, asset) => {
                if (err || !asset) {
                    console.error('[FontManager] ❌ 中文子集字体加载【失败】→ 中文将回退系统字体', err);
                } else {
                    this._cjk = asset as Font;
                    this._log('✅ 中文子集字体加载成功：', asset.name, '| isFont=', asset instanceof Font);
                }
                done();
            });
        });
        return this._loading;
    }

    /** 拉丁 Label（Orbitron）。 */
    static attach(lbl: Label): void {
        (lbl as any).__gk = 'latin';
        if (this._latin) {
            lbl.font = this._latin;
            this._log('attach(latin) → 套用 Orbitron 资源 |', this._lblInfo(lbl));
        } else {
            lbl.fontFamily = this.GAME_FONT;
            this._warn('attach(latin) → 资源未就绪，回退 fontFamily=', this.GAME_FONT, '|', this._lblInfo(lbl));
        }
    }

    /** 中文 / 含中文的 Label（Noto Sans SC 子集）。 */
    static attachCJK(lbl: Label): void {
        (lbl as any).__gk = 'cjk';
        if (this._cjk) {
            lbl.font = this._cjk;
            this._log('attachCJK → 套用 NotoSansSC 资源 |', this._lblInfo(lbl));
        } else {
            lbl.fontFamily = this.CJK_FALLBACK;
            this._warn('attachCJK → 资源未就绪，回退 fontFamily=', this.CJK_FALLBACK, '|', this._lblInfo(lbl));
        }
    }

    /**
     * 仅标记 Label 的字体类型，不立即套用。
     * 用于组件 onLoad 期间「新建 Label」的场景——此时字体资源可能尚未加载完，
     * 直接 attach 会触发「资源未就绪」回退警告（且短暂闪系统字体）。
     * 标记后，由上级 Bootstrap 的 `await FontManager.use(root)` 在字体就绪后统一套用。
     */
    static mark(lbl: Label, kind: FontKind): void {
        (lbl as any).__gk = kind;
    }
    /** 标记拉丁 Label（Orbitron），等待 use(root) 统一套用 */
    static markLatin(lbl: Label): void { this.mark(lbl, 'latin'); }
    /** 标记中文 / 含中文 Label（Noto Sans SC 子集），等待 use(root) 统一套用 */
    static markCJK(lbl: Label): void { this.mark(lbl, 'cjk'); }

    /** 简短标识某个 Label（节点名 + 文本前 12 字），便于在日志里追踪。 */
    private static _lblInfo(lbl: Label): string {
        const t = (lbl.string ?? '').toString().replace(/\s+/g, ' ').slice(0, 12);
        return `节点=${lbl.node.name} 文本="${t}"`;
    }

    /** 递归刷新节点树下所有「已标记」的 Label（加载完成后统一兜底）。 */
    static applyToNode(root: Node | null): void {
        if (!root) return;
        const stack: Node[] = [root];
        while (stack.length) {
            const n = stack.pop()!;
            const lbl = n.getComponent(Label);
            if (lbl) {
                const kind = (lbl as any).__gk as FontKind | undefined;
                if (kind === 'latin') this.attach(lbl);
                else if (kind === 'cjk') this.attachCJK(lbl);
                // 未标记的 Label（如场景静态 Label）不动，保持原样
            }
            for (const c of n.children) stack.push(c);
        }
    }

    /** 统计 root 下所有「已标记」Label 的最终状态：套用资源 vs 回退系统字体。 */
    private static _summarize(root: Node | null): string {
        if (!root) return 'root=null';
        let latinRes = 0, latinSys = 0, cjkRes = 0, cjkSys = 0, untagged = 0;
        const stack: Node[] = [root];
        while (stack.length) {
            const n = stack.pop()!;
            const lbl = n.getComponent(Label);
            if (lbl) {
                const kind = (lbl as any).__gk as FontKind | undefined;
                const usedSys = (lbl as any).isSystemFontUsed === true;
                if (kind === 'latin') (usedSys ? latinSys++ : latinRes++);
                else if (kind === 'cjk') (usedSys ? cjkSys++ : cjkRes++);
                else untagged++;
            }
            for (const c of n.children) stack.push(c);
        }
        return `已套用字体资源: latin=${latinRes} cjk=${cjkRes} | 回退系统字体: latin=${latinSys} cjk=${cjkSys} | 未标记=${untagged}`;
    }

    /** 一步到位：等两种字体就绪 → 再统一套用一次（不在就绪前打占位警告）。 */
    static async use(root: Node | null): Promise<void> {
        if (this.DEBUG) console.log('%c[FontManager] 字体诊断已启用 (DEBUG=true)', 'color:#9EFF00');
        this._log('use() 开始：等字体就绪后统一套用');
        await this.ensureLoaded();
        this.applyToNode(root);
        this._log('use() 完成 →',
            `Orbitron=${this._latin ? this._latin.name : 'FAILED'} |`,
            `CJK=${this._cjk ? this._cjk.name : 'FAILED'} |`,
            this._summarize(root));
    }
}
