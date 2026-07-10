/**
 * GameBootstrap.ts — 战斗场景启动骨架（scripts/game/）
 *
 * 最小骨架：从 SessionState 读取本次进入的关卡 ID，校验后交给战斗逻辑扩展点。
 * 加载界面、转场特效、单人/多人模式等按 level-select 流程确定后再行设计。
 *
 * 挂载：game.scene 根节点（或任意常驻节点）。
 */

import { _decorator, Component, director } from 'cc';
import { SessionState } from '../core/SessionState';
import { LevelDataManager } from '../core/LevelDataManager';

const { ccclass } = _decorator;

@ccclass('GameBootstrap')
export class GameBootstrap extends Component {

    onLoad(): void {
        this._boot();
    }

    private _boot(): void {
        const levelId = SessionState.instance.selectedLevelId;

        // 校验：未选择 / 越界 → 退回 level-select，避免黑屏
        if (!levelId || levelId < 1) {
            console.warn('[GameBootstrap] 未选中关卡，退回 level-select');
            director.loadScene('level-select');
            return;
        }

        // 数据单例已在 level-select 加载并缓存；此处取用即可。
        // （若需 game.scene 独立预览，可改为 `await LevelDataManager.instance.load()`。）
        const level = LevelDataManager.instance.getLevelById(levelId);
        if (!level) {
            console.warn(`[GameBootstrap] 找不到关卡 Lv.${levelId}，退回 level-select`);
            director.loadScene('level-select');
            return;
        }

        console.log(`[GameBootstrap] 进入关卡 Lv.${levelId}（${level.name}）— 骨架占位`);
        this._startBattle(levelId);
    }

    /**
     * 战斗初始化扩展点（待 level-select 完成后设计）。
     * 按规划：后续在此接入单人 / 多人 MatchSource 体系，基于关卡数据构建战斗场景。
     */
    private _startBattle(levelId: number): void {
        // TODO: 基于关卡数据构建战斗场景
    }
}
