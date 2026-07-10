/**
 * ChapterTransition.ts — 扫描擦除 + 数据前置更新
 *
 * 设计约束（用户决议）：
 *   - 节点 & 粒子显隐通过 tween .transitionAlpha 控制 Graphics 颜色 alpha，
 *     禁止用 scale（已否决），也不依赖 UIOpacity（因 Cocos 3.x Graphics 不读它）。
 *   - 节点池化复用，不销毁、不重建。
 *   - 数据在过渡开始前（wipeOut 之后、bootup 之前）写入节点。
 *
 * 三阶段：shutdown(扫描擦除) → reconfigure(外部写数据) → bootup(扫描式淡入)
 */

import { _decorator, Component, tween, Tween } from 'cc';
import { LevelNode } from './LevelNode';
import { ScanSweep } from './ScanSweep';
import { OrbitParticles } from './OrbitParticles';

const { ccclass, property } = _decorator;

@ccclass('ChapterTransition')
export class ChapterTransition extends Component {

    @property({ tooltip: '扫描擦除总时长（秒），扫描线从顶到底走完一遍' })
    wipeDur: number = 0.5;

    @property({ tooltip: '单个节点淡出/淡入时长（秒）' })
    fadeDur: number = 0.18;

    @property({ tooltip: 'OrbitZone 高度，用于按节点 Y 坐标错峰' })
    zoneH: number = 720;

    isTransitioning = false;
    levelNodes: LevelNode[] = [];

    /**
     * 扫描线每帧局部 Y 回调（透传自 ScanSweep.onScanY）。
     * Bootstrap 用它让章名在「扫描线落下来」时才淡出，配合扫描节奏而非独立过渡。
     */
    onScanProgress: ((y: number) => void) | null = null;

    private _scanSweep: ScanSweep | null = null;
    private _orbitParticles: OrbitParticles | null = null;

    onLoad(): void {
        this._scanSweep = this.node.getChildByName('ScanSweep')?.getComponent(ScanSweep) ?? null;
        this._orbitParticles = this.node.getChildByName('OrbitParticles')?.getComponent(OrbitParticles) ?? null;
    }

    /** 仅擦除：节点淡出 + 粒子淡出 + 扫描线。不销毁节点。 */
    async wipeOut(): Promise<void> {
        if (this._orbitParticles) {
            Tween.stopAllByTarget(this._orbitParticles);
            tween(this._orbitParticles).to(this.fadeDur, { transitionAlpha: 0 }).start();
        }
        // 透传扫描线位置（供章名等配合节奏）
        if (this._scanSweep) this._scanSweep.onScanY = (y) => this.onScanProgress?.(y);
        await this._wipeOut();
    }

    /** 启动：数据已在新章写入。节点淡入 + 粒子淡入（不重置粒子）。 */
    async bootup(): Promise<void> {
        if (this._orbitParticles) {
            Tween.stopAllByTarget(this._orbitParticles);
            this._orbitParticles.transitionAlpha = 0;
            tween(this._orbitParticles).to(this.fadeDur, { transitionAlpha: 255 }).start();
        }
        await this._bootup();
    }

    /** 完整过渡（测试用，不经过外部数据更新） */
    async switchChapter(): Promise<void> {
        if (this.isTransitioning) return;
        this.isTransitioning = true;
        await this.wipeOut();
        await this._pause(0.05);
        await this.bootup();
        this.isTransitioning = false;
    }

    // ==================== Phase 1: 扫描擦除（tween transitionAlpha） ====================

    private async _wipeOut(): Promise<void> {
        const topY = this.zoneH / 2;
        const proms: Promise<void>[] = [];

        for (const ln of this.levelNodes) {
            if (!ln.node.isValid) continue;
            Tween.stopAllByTarget(ln);
            const nodeY = ln.node.position.y;
            const delay = Math.max(0, (topY - nodeY) / this.zoneH * this.wipeDur);

            proms.push(new Promise<void>(resolve => {
                tween(ln)
                    .delay(delay)
                    .to(this.fadeDur, { transitionAlpha: 0 })
                    .call(() => resolve())
                    .start();
            }));
        }

        // 扫描线与擦除并行
        const sweepTask = this._scanSweep
            ? this._scanSweep.sweep()
            : new Promise(r => setTimeout(r, this.wipeDur * 1000));

        await Promise.all([sweepTask, ...proms]);
    }

    // ==================== Phase 3: 启动（tween transitionAlpha） ====================

    private async _bootup(): Promise<void> {
        const topY = this.zoneH / 2;
        const proms: Promise<void>[] = [];

        for (const ln of this.levelNodes) {
            if (!ln.node.isValid) continue;
            Tween.stopAllByTarget(ln);
            // 先完全透明，再错峰淡入
            ln.transitionAlpha = 0;
            const nodeY = ln.node.position.y;
            const delay = Math.max(0, (topY - nodeY) / this.zoneH * this.wipeDur);

            proms.push(new Promise<void>(resolve => {
                tween(ln)
                    .delay(delay)
                    .to(this.fadeDur, { transitionAlpha: 255 })
                    .call(() => resolve())
                    .start();
            }));
        }

        // （章节圆点 ChapterDots 为控制级 UI，恒定不参与扫描擦除/淡入，故此处无额外目标）


        await Promise.all(proms);
    }

    // ==================== 工具 ====================

    private _pause(s: number): Promise<void> {
        return new Promise(r => setTimeout(r, s * 1000));
    }
}
