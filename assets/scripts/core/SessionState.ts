/**
 * SessionState.ts
 * 会话临时状态单例 —— 跨场景传递的一次性数据
 *
 * 职责：
 *   1. 暂存当前选中关卡 ID（level-select → battle 传递）
 *   2. 暂存当前章节索引（battle → level-select 返回恢复）
 *   3. 未来扩展：房间 ID、对战模式、观战目标等
 *
 * 设计：
 *   - 纯 class 单例（同 SettingsManager），不挂节点，不挂 persistRootNode
 *   - 不持久化到 localStorage（与"上次进度"是不同的语义）
 *   - 生命周期 = 一次游戏会话（退出进程即消亡）
 *   - 放 core/ 层，与 SettingsManager 同级别
 *
 * 用法：
 *   import { SessionState } from '../core/SessionState';
 *   SessionState.instance.selectedLevelId = node.globalId;
 */

export class SessionState {

    private static _instance: SessionState | null = null;

    static get instance(): SessionState {
        if (!this._instance) {
            this._instance = new SessionState();
        }
        return this._instance;
    }

    /** 当前选中的关卡全局 ID（1-48） */
    selectedLevelId: number = 0;

    /** 当前所在章节索引（0-3），用于 battle → level-select 返回时恢复章节 */
    currentChapterIndex: number = 0;

    // ===== 未来扩展字段（预留） =====
    // roomId: string = '';
    // matchMode: string = '';
    // lastResult: any = null;

    private constructor() {}
}
