import { Color } from 'cc';

/**
 * Theme.ts — 共享状态色板
 *
 * 状态环（CoreEffect）与章节圆点导航（ChapterDots）共用同一套章节状态色，
 * 防止两处各写 hex 导致语义漂移。统一含义：
 *   done      = 全部通关 → 信号绿
 *   pending   = 待通关（已解锁未全通）→ 橙
 *   locked    = 未解锁 → 亮灰
 *   doneBadge = 精通徽章（叠加在绿上的一圈细金环，纯成就标记，不破坏三态统一）
 */
export const THEME = {
    chapterDone: new Color(158, 255, 0),     // 信号绿 #9EFF00
    chapterPending: new Color(255, 158, 61), // 橙 #FF9E3D
    chapterLocked: new Color(154, 160, 166), // 亮灰 #9AA0A6
    chapterDoneBadge: new Color(239, 195, 74), // 金 #EFC34A
};
