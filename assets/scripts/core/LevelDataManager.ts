/**
 * LevelDataManager.ts — 关卡数据 + 进度管理器（单例）
 *
 * 逐关追踪，不是 "completedCount" 单值。
 * 存储：localStorage key = "graphray_level_progress"
 *       格式 = { chapterId: [completedGlobalId1, completedGlobalId2, ...] }
 *
 * 解锁规则（v3）：
 *   通关 Lv.N → Lv.N+1、Lv.N+2 均变为 challengeable（常规「看两关 ahead」）。
 *   特殊规则：若 N 是某章最后一关，则它「仅解锁下一章的第一关」，不解锁下一章第 2 关。
 *     （实现：推导时，globalId-2 路径在「globalId-2 为章末」时失效，第 2 关改由
 *      下一章首关通关后经 globalId-1 路径解锁——即必须真打过下一章首关。）
 *   累积效果：多条通路同时开放，跳过的关保持 challengeable（不是 completed）。
 *   章节定位：全部基于 levels[] 动态范围（getLevelStatus / _isChapterLast / _findChapterByGlobalId
 *     均以 levels[0].globalId ≤ id ≤ levels[last].globalId 判定所属章），不假设每章固定 12 关；
 *     仅 _normalizeServerData 的旧存档兼容分支仍依赖「每章 12 关」假设（历史遗留，新存档不受影响）。
 */

import { resources, JsonAsset, sys } from 'cc';
import { Config } from './Config';
import { LevelStatus } from '../level-select/LevelNode';

// ==================== 类型 ====================

export interface LevelMeta {
    globalId: number;
    name: string;
    description: string;
    /** 作者是否已完成该关卡的制作（静态字段，来自 chapters.json，默认 false）。
     *  与玩家通关进度 completedIds 完全无关——前者是"关卡有没有内容可玩"，后者是"玩家打没打通关"。 */
    completed?: boolean;
}

export interface ChapterMeta {
    id: number;
    name: string;
    description: string;
    completedIds: number[];     // 已通关的 globalId 列表（替换旧 completedCount）
    levels: LevelMeta[];
}

interface ChaptersData {
    chapters: Omit<ChapterMeta, 'completedIds'>[];
}

// ==================== 常量 ====================

const PROGRESS_KEY = 'graphray_level_progress';
const CHAPTERS_PATH = 'configs/levels/chapters';
const LEVEL_FILE_PREFIX = 'configs/levels/level-';   // 战斗文件：level-{globalId}.json

// ==================== 单例 ====================

export class LevelDataManager {
    private static _instance: LevelDataManager;

    static get instance(): LevelDataManager {
        if (!this._instance) this._instance = new LevelDataManager();
        return this._instance;
    }

    private _chapters: ChapterMeta[] = [];
    private _loaded = false;

    get ready(): boolean { return this._loaded; }

    private constructor() {}

    // ==================== 加载 ====================

    async load(): Promise<void> {
        if (this._loaded) return;

        return new Promise((resolve, reject) => {
            resources.load(CHAPTERS_PATH, JsonAsset, async (err, asset) => {
                if (err) { console.error('[LM] 加载失败:', err); reject(err); return; }

                const data = asset.json as ChaptersData;
                if (!data?.chapters?.length) {
                    reject(new Error('chapters.json 异常')); return;
                }

                // 进度加载：服务端优先 → localStorage
                const saved = await this._loadProgress();

                this._chapters = data.chapters.map(ch => ({
                    ...ch,
                    // completedIds = 玩家通关进度（运行时，来自存档）。
                    // levels[].completed = 作者制作标志（静态，由 ...ch 透传，来自 chapters.json）。
                    // 二者互不干扰：completed 不在此派生、不写入存档。
                    completedIds: saved[ch.id] ?? [],
                }));

                // 开发期护栏：交叉校验 completed 标志与战斗文件是否一致（仅 console 警告，不影响逻辑）
                this._validateLevelFiles();

                this._loaded = true;
                console.log(`[LM] 加载完成，${this._chapters.length} 章，已完成 ${this._totalCompleted()} 关`);
                resolve();
            });
        });
    }

    // ==================== 查询 ====================

    getChapters(): ReadonlyArray<ChapterMeta> { return this._chapters; }
    getLevelById(globalId: number): LevelMeta | null {
        for (const ch of this._chapters) {
            const f = ch.levels.find(l => l.globalId === globalId);
            if (f) return f;
        }
        return null;
    }
    getChapterByIndex(index: number): ChapterMeta | null {
        return this._chapters[index] ?? null;
    }

    /**
     * 逐关推导。规则：
     *   - 通关 Lv.N → Lv.N+1 和 Lv.N+2 均变为 CHALLENGEABLE（常规看两关 ahead）。
     *   - 每章第 1 关通过跨章门禁后始终可挑战。
     *   - 特殊规则：若 N-2 是某章最后一关，则它「仅解锁下一章首关」(已由首关规则开放)，
     *     不再顺带解锁下一章第 2 关（即本关）；本关改由 N-1 路径（下一章首关通关后）解锁。
     *   - 数据源：completedIds[] 数组，跨章全局查找 N-1/N-2。
     */
    getLevelStatus(globalId: number): LevelStatus {
        // 动态定位所属章节（基于 levels[] 范围，不假设每章固定关数）
        const ch = this._findChapterByGlobalId(globalId);
        if (!ch) return LevelStatus.LOCKED;
        const chapterIndex = this._chapters.indexOf(ch);
        if (chapterIndex < 0) return LevelStatus.LOCKED;
        if (!this.isChapterAccessible(chapterIndex)) return LevelStatus.LOCKED;

        // 已完成
        if (this._isAnyComplete(globalId)) return LevelStatus.COMPLETE;

        // 本章首关（动态取 levels[0]，不假设 globalId 形如 12k+1）
        if (globalId === ch.levels[0].globalId) return LevelStatus.CHALLENGEABLE;

        // N-1 已通关 → 可挑战（跨章查找）
        if (this._isAnyComplete(globalId - 1)) return LevelStatus.CHALLENGEABLE;

        // N-2 已通关 → 可挑战；但若 N-2 是某章最后一关，则「仅解锁下一章首关」，
        // 不解锁下一章第 2 关（即本关）→ 此路径失效，本关改由 N-1 路径解锁。
        const prev2 = globalId - 2;
        if (prev2 >= 1 && !this._isChapterLast(prev2) && this._isAnyComplete(prev2)) {
            return LevelStatus.CHALLENGEABLE;
        }

        return LevelStatus.LOCKED;
    }

    /** 某 globalId 是否为所在章的最后一关（用于「章末仅解锁下一章首关」特殊规则）。
     *  动态定位所属章（基于 levels[] 范围），再与该章末关比对——不假设每章固定关数。 */
    private _isChapterLast(globalId: number): boolean {
        const ch = this._findChapterByGlobalId(globalId);
        if (!ch || ch.levels.length === 0) return false;
        const last = ch.levels[ch.levels.length - 1];
        return last != null && last.globalId === globalId;
    }

    /** 检查某个 globalId 是否在任意章节的 completedIds 中 */
    private _isAnyComplete(globalId: number): boolean {
        for (const c of this._chapters) {
            if (c.completedIds.includes(globalId)) return true;
        }
        return false;
    }

    getLevelCount(chapterIndex: number): number {
        return this._chapters[chapterIndex]?.levels.length ?? 0;
    }

    // ==================== 进度 ====================

    markComplete(globalId: number): void {
        const ch = this._findChapterByGlobalId(globalId);
        if (!ch) return;

        const status = this.getLevelStatus(globalId);
        if (status !== LevelStatus.CHALLENGEABLE && status !== LevelStatus.COMPLETE) {
            console.warn(`[LM] 关卡 ${globalId} 不可完成 (status: ${status})`);
            return;
        }
        if (ch.completedIds.includes(globalId)) return; // 已通关，幂等

        ch.completedIds.push(globalId);
        ch.completedIds.sort((a, b) => a - b);

        // 常规：通关 N 解锁 N+1 与 N+2；章末（N 是章最后一关）则仅解锁下一章首关(N+1)。
        const isChapterEnd = this._isChapterLast(globalId);
        const unlockNote = isChapterEnd
            ? `下一章首关 ${globalId + 1} 解锁（章末特殊规则：仅解锁首关）`
            : `${globalId + 1} 与 ${globalId + 2} 解锁`;
        console.log(`[LM] 关卡 ${globalId} 通关！本关=COMPLETE, ${unlockNote}`);
        this._saveProgress();
    }

    /** 将当前内存中的进度持久化到 localStorage + 服务器 */
    saveProgress(): void {
        this._saveProgress();
    }

    getChapterProgress(chapterIndex: number): number {
        const ch = this._chapters[chapterIndex];
        if (!ch || ch.levels.length === 0) return 0;
        return Math.min(ch.completedIds.length / ch.levels.length, 1);
    }

    // ==================== 章节解锁（跨章） ====================

    isChapterAccessible(chapterIndex: number): boolean {
        if (chapterIndex === 0) return true;
        const prev = this._chapters[chapterIndex - 1];
        if (!prev) return false;
        // Boss 关 = 本章最后一关的 globalId 在已完成列表中
        const bossId = prev.levels[prev.levels.length - 1]?.globalId;
        return bossId != null && prev.completedIds.includes(bossId);
    }

    // ==================== 进度存储 ====================

    /** 加载进度：服务端 + 本地并集合并（防离线丢失），服务端优先但本地不丢 */
    private async _loadProgress(): Promise<Record<number, number[]>> {
        if (Config.API_BASE) {
            try {
                const res = await this._fetchWithTimeout(`${Config.API_BASE}/user/progress`);
                if (res?.ok && res.data) {
                    const server = this._normalizeServerData(res.data);
                    const local  = this._loadLocalProgress();
                    const merged = this._mergeProgress(server, local);

                    // 本地比服务端多（离线打的）→ 异步补推服务端
                    if (this._differsFrom(server, merged)) {
                        console.log('[LM] 本地有多余进度，异步同步至服务器');
                        this._pushToServer(merged);
                    }
                    return merged;
                }
            } catch (e) {
                console.warn('[LM] 服务器进度失败，降级本地:', e);
            }
        }
        return this._loadLocalProgress();
    }

    /** 保存进度：服务器异步 + 本地缓存 */
    private _saveProgress(): void {
        const data: Record<number, number[]> = {};
        for (const ch of this._chapters) data[ch.id] = [...ch.completedIds];
        this._saveLocalProgress(data);
        if (Config.API_BASE) {
            this._fetchWithTimeout(`${Config.API_BASE}/user/progress`, {
                method: 'PUT',
                body: JSON.stringify(data),
            }).catch(e => console.warn('[LM] 服务器同步失败:', e));
        }
    }

    // ==================== 进度合并 ====================

    /** 并集合并：每章取 server ∪ local 的最大集（排序去重） */
    private _mergeProgress(server: Record<number, number[]>, local: Record<number, number[]>): Record<number, number[]> {
        const allKeys = new Set([...Object.keys(server), ...Object.keys(local)].map(Number));
        const out: Record<number, number[]> = {};
        for (const chId of allKeys) {
            const ids = new Set([...(server[chId] ?? []), ...(local[chId] ?? [])]);
            out[chId] = [...ids].sort((a, b) => a - b);
        }
        return out;
    }

    /** 合并后的数据是否比服务端多出关卡（说明本地有离线进度待同步） */
    private _differsFrom(server: Record<number, number[]>, merged: Record<number, number[]>): boolean {
        for (const chId of Object.keys(merged)) {
            const ch = Number(chId);
            if ((merged[ch]?.length ?? 0) > (server[ch]?.length ?? 0)) return true;
        }
        return false;
    }

    /** 异步推进度回服务端（不阻塞、不抛异常） */
    private _pushToServer(data: Record<number, number[]>): void {
        if (!Config.API_BASE) return;
        this._fetchWithTimeout(`${Config.API_BASE}/user/progress`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }).catch(e => console.warn('[LM] 补推进度失败:', e));
    }

    // ==================== 本地存储 ====================

    private _loadLocalProgress(): Record<number, number[]> {
        try {
            const raw = sys.localStorage.getItem(PROGRESS_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            // 兼容旧格式 { chId: count } → 转为新格式 { chId: [ids] }
            return this._normalizeServerData(parsed);
        } catch { return {}; }
    }

    private _saveLocalProgress(data: Record<number, number[]>): void {
        sys.localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
    }

    /** 兼容旧格式 { chId: number } → 新格式 { chId: number[] } */
    private _normalizeServerData(raw: any): Record<number, number[]> {
        const out: Record<number, number[]> = {};
        for (const key of Object.keys(raw)) {
            const chId = Number(key);
            const val = raw[key];
            if (Array.isArray(val)) {
                out[chId] = val;
            } else if (typeof val === 'number' && val > 0) {
                // 旧格式（v1 存档兼容）：仅存 completedCount → 按「每章固定 12 关」推导 ID 列表。
                // 注意：此分支依赖历史假设，新存档均为 { chId: number[] } 数组格式，不触发本分支。
                const base = (chId - 1) * 12;
                out[chId] = Array.from({ length: val }, (_, i) => base + i + 1);
            }
        }
        return out;
    }

    // ==================== HTTP ====================

    private async _fetchWithTimeout(url: string, options?: RequestInit): Promise<any> {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), Config.TIMEOUT_MS);
        try {
            const res = await fetch(url, {
                ...options,
                signal: ctrl.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...(this._getAuthHeader()),
                    ...(options?.headers ?? {}),
                },
            });
            clearTimeout(t);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return { ok: true, data: await res.json() };
        } catch (e) {
            clearTimeout(t);
            throw e;
        }
    }

    private _getAuthHeader(): Record<string, string> {
        try {
            const raw = sys.localStorage.getItem('zzyhub_token');
            if (raw) return { Authorization: `Bearer ${JSON.parse(raw)}` };
        } catch {}
        try {
            const raw = (globalThis as any).wx?.getStorageSync?.('graphray_token');
            if (raw) return { Authorization: `Bearer ${raw}` };
        } catch {}
        return {};
    }

    // ==================== 内部 ====================

    /** 根据 globalId 动态定位所属章节（基于 levels[] 范围，不假设每章固定关数） */
    private _findChapterByGlobalId(globalId: number): ChapterMeta | null {
        for (const ch of this._chapters) {
            if (ch.levels.length === 0) continue;
            const first = ch.levels[0].globalId;
            const last = ch.levels[ch.levels.length - 1].globalId;
            if (globalId >= first && globalId <= last) return ch;
        }
        return null;
    }

    private _totalCompleted(): number {
        return this._chapters.reduce((s, c) => s + c.completedIds.length, 0);
    }

    private _totalLevels(): number {
        return this._chapters.reduce((s, c) => s + c.levels.length, 0);
    }

    /**
     * 开发期护栏：交叉校验 chapters.json 的 completed 标志与磁盘上 level-{globalId}.json 战斗文件是否一致。
     *   - completed:true 但文件缺失/加载失败 → 警告（标记做好了，但战斗文件没建）
     *   - completed:false 但文件存在         → 警告（文件已建，但 flag 没翻 true）
     * 仅开发期运行：CC_DEBUG 为 false（release 构建）时直接跳过；编辑器/debug 构建均会执行。
     * 纯校验，不修改任何数据、不影响 enterable 判定。
     * 注意：对尚未创建战斗文件的关，引擎本身可能打印 "Failed to load" 类错误，那是预期内的；
     *       真正有意义的是本方法打出的 [LM][护栏] 警告与末尾的校验汇总。
     */
    private _validateLevelFiles(): void {
        const CC_DEBUG = (globalThis as any).CC_DEBUG as boolean | undefined;
        if (CC_DEBUG === false) return;   // release 构建跳过；undefined（多数编辑器环境）或 true 时仍跑

        const total = this._totalLevels();
        let checked = 0, mismatches = 0;

        for (const ch of this._chapters) {
            for (const lv of ch.levels) {
                const path = `${LEVEL_FILE_PREFIX}${lv.globalId}`;
                resources.load(path, JsonAsset, (err) => {
                    checked++;
                    const exists = !err;
                    const built = lv.completed === true;
                    if (built && !exists) {
                        mismatches++;
                        console.warn(`[LM][护栏] 关卡 ${lv.globalId}「${lv.name}」标记为已完成(completed:true)，但战斗文件 ${path}.json 缺失/加载失败。请确认是否已创建该关卡 battle 配置，或把 completed 改回 false。`);
                    } else if (!built && exists) {
                        mismatches++;
                        console.warn(`[LM][护栏] 关卡 ${lv.globalId}「${lv.name}」战斗文件 ${path}.json 已存在，但 chapters.json 中 completed 仍为 false。若关卡已可玩，请将 completed 改为 true。`);
                    }
                    if (checked === total) {
                        console.log(`[LM][护栏] 校验完成：${total} 关，其中 ${mismatches} 处 completed 标志与战斗文件不一致。`);
                    }
                });
            }
        }
    }
}
