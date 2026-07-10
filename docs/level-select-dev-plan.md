# GraphRay 关卡选择界面 — 开发方案

> 对应需求文档：`docs/level-select-requirements.md`
> 创建日期：2026-07-06
> ✅ **状态：已验收（2026-07-10）** —— 本方案规划的 Step 0–7 全部落地并实机验收通过。文中规划与最终实机形态一致（含 BubblePopup 取代 LevelInfoCard、引导线 L 型锚定、分辨率 SHOW_ALL 等后续收敛项）。

---

## 一、实现原则

| 原则 | 含义 |
|------|------|
| **数据驱动** | 关卡名称、描述由 `chapters.json` 定义；布局坐标、轨道参数、过渡时序由 `layout.json` 定义。代码只负责读取+驱动，不硬编码业务数据 |
| **关注点分离** | 元数据（chapters.json）/ 布局配置（layout.json）/ 战斗内容（level-{id}.json）/ 会话状态（SessionState）各自独立，互不污染 |
| **拓展性** | 新增章节 = JSON 追加 + 一张背景图；新增关卡 = JSON 追加；布局调参 = 改 layout.json，零代码改动 |
| **混合搭建** | 场景静态层（Canvas/Camera/星空/背景图/顶底栏/容器）在编辑器中搭建；动态层（节点/指示点/粒子/扫描线）在代码中创建 |
| **保留现有机制** | 不引入新的架构模式。复用 SettingsManager 单例模式；复用 AudioManager 跨场景存活 |

---

## 二、数据模型与配置文件

### 2.1 关卡元数据 — `chapters.json`

**路径**：`assets/resources/configs/levels/chapters.json`
**职责**：关卡是什么——名称、描述。这是纯元数据，包含任何布局/动效参数。

```jsonc
{
  "chapters": [
    {
      "id": 1,
      "name": "[第1章名称待定]",
      "completedCount": 7,
      "levels": [
        {
          "globalId": 1,
          "name": "[关卡名称待定]",
          "description": "[关卡描述待定]",
          "recommendedFunctions": []
        }
        // ... 12 项/章
      ]
    }
    // ... 共 4 章
  ]
}
```

| 字段 | 说明 |
|------|------|
| `chapters[].id` | 章节编号 1-4 |
| `chapters[].name` | 章节名称 |
| `chapters[].completedCount` | 已通关数量，用于运行时推导各关卡状态（临时方案，未来接后端） |
| `levels[].globalId` | 全局连续编号 1-48 |
| `levels[].name` | 关卡名称（显示在节点和信息卡上） |
| `levels[].description` | 关卡描述（显示在信息卡上） |
| `levels[].recommendedFunctions` | 推荐函数列表（可选，显示在信息卡上作为提示） |

> **关卡编号**：全局连续，公式 `globalId = (chapterId - 1) × 12 + localIndex + 1`。
> **状态推导**（由 LevelDataManager 完成）：`completedCount` → 4 种状态。`i < completedCount` = complete；`i === completedCount \|\| i === completedCount + 1` = challengeable；`i <= completedCount + 3` = unlocked；其他 = locked。

### 2.2 战斗内容数据 — `level-{globalId}.json`

**路径**：`assets/resources/configs/levels/level-{globalId}.json`（如 `level-1.json`）
**职责**：战斗场景所需的单关内容数据（敌人布局、障碍物、目标、初始函数等）。

> ⚠️ 此文件结构待战斗场景设计完成后定义。当前暂不创建，仅预留路径约定。
> 选择界面不加载此文件；BattleBootstrap 按 `SessionState.selectedLevelId` 加载对应文件。

### 2.3 场景布局配置 — `level-select-layout.json`

**路径**：`assets/resources/configs/levels/level-select-layout.json`
**职责**：关卡选择场景的展示参数——坐标、轨道、过渡时序、章节外观。与关卡内容无关，纯"怎么画"的参数。

```jsonc
{
  "chapters": [
    {
      "id": 1,
      "romanNumeral": "I",
      "labelPosition": { "x": 180, "y": 268 },
      "backgroundTexture": "textures/level-select/chapter-1-bg"
    }
    // ... 共 4 章
  ],
  "orbitRings": [
    { "x": 180, "y": 110, "width": 1560, "height": 500, "opacity": 0.09 },
    { "x": 280, "y": 150, "width": 1360, "height": 420, "opacity": 0.14 },
    { "x": 380, "y": 190, "width": 1160, "height": 340, "opacity": 0.19 },
    { "x": 480, "y": 225, "width": 960,  "height": 270, "opacity": 0.24 }
  ],
  "nodePositions": [
    { "x": 260, "y": 348 },
    // ... 共 12 个（所有章节共用同一套轨道坐标）
  ],
  "interludes": [
    { "chapterId": 1, "id": 1, "x": 190, "y": 310 },
    { "chapterId": 1, "id": 2, "x": 280, "y": 265 }
    // ... 按章分组
  ],
  "corePosition": { "x": 960, "y": 360 },
  "transition": {
    "shutdownMs": 500,
    "reconfigureMs": 450,
    "bootupMs": 1200,
    "nodeStaggerMs": 60
  }
}
```

| 字段 | 说明 |
|------|------|
| `chapters[].romanNumeral` | 章节罗马数字标识 |
| `chapters[].labelPosition` | 章节标签在轨道区的展示坐标 |
| `chapters[].backgroundTexture` | 章节专属背景图路径（`resources/` 相对路径） |
| `orbitRings[]` | 4 条椭圆轨道的位置、尺寸和不透明度 |
| `nodePositions[]` | 12 个关卡节点在轨道区的坐标（所有章共用） |
| `interludes[]` | 间章节点坐标，按 `chapterId` 分组 |
| `corePosition` | 中央核心的坐标 |
| `transition` | 章节切换三段式过渡的时序参数 |

### 2.4 会话状态 — `SessionState`

**路径**：`assets/scripts/core/SessionState.ts`
**职责**：跨场景传递的一次性会话临时状态。

```typescript
// 纯 class 单例，不挂节点，不跨场景持久（不挂 persistRootNode）
// 生命周期 = 一次游戏会话（退出进程即消亡）
// 不持久化到 localStorage

export class SessionState {
    private static _instance: SessionState;
    static get instance(): SessionState { ... }

    /** 当前选中的关卡全局 ID（level-select → battle 传递） */
    selectedLevelId: number = 0;

    /** 当前所在章节索引（用于 battle → level-select 返回恢复） */
    currentChapterIndex: number = 0;

    /** 未来扩展：房间 ID、对战模式、观战目标、上一局结果等 */
}
```

**设计决策**：
- 放 `core/` — 与 SettingsManager 同层，同为纯 class 单例
- 不持久化 — 会话临时态不应写入 localStorage（与"上次进度"是不同语义）
- 轻量 — 仅 static 字段，无订阅机制，无校验，无持久化

---

## 三、架构分层与组件职责

### 3.1 文件清单

```
assets/scripts/
├── core/
│   ├── SessionState.ts               # 会话临时状态（新建）
│   └── LevelDataManager.ts           # 关卡数据管理器（待重建）
├── level-select/
│   └── StarfieldEffect.ts            # 星空背景粒子（已创建）
└── ui-tools/
    ├── LevelSelectBootstrap.ts       # 场景入口，组装全部节点
    ├── ChapterTransition.ts          # 三段式过渡控制器
    ├── LevelNode.ts                  # 关卡节点组件（4 状态视觉 + 动画）
    ├── LevelInfoCard.ts              # 右侧信息卡片
    ├── StarfieldEffect.ts            # 星空背景粒子
    ├── OrbitParticles.ts             # 轨道数据流粒子
    └── ScanSweep.ts                  # 章节切换扫描线
```

### 3.2 数据流

```
                 chapters.json              level-select-layout.json
                      ↓                              ↓
LevelSelectBootstrap.onLoad()                         │
  → LevelDataManager.instance.load()                 │
  → resources.load('configs/levels/level-select-layout')
                      ↓                              ↓
              LevelDataManager.getChapter()    布局参数 → 渲染轨道/节点/核心
              LevelDataManager.getLevelStatus()
                      ↓
              渲染 12 个 LevelNode（状态+坐标+名称）
              绑定导航/点击事件
```

### 3.3 组件职责概要

| 组件 | 职责 | 层级 |
|------|------|------|
| `SessionState` | 会话临时状态：selectedLevelId, currentChapterIndex | core |
| `LevelDataManager` | 加载 chapters.json + 状态推导 + 进度读写。单例，仅服务 level-select 场景 | core |
| `LevelSelectBootstrap` | 场景入口：初始化 AudioManager/SettingsManager → 加载 chapters + layout → 构建节点树 → 绑定导航/事件 → 渲染第一章。挂 Canvas 节点 | ui-tools |
| `ChapterTransition` | 三段式过渡（Shutdown→Reconfigure→Boot-up），协调节点/粒子/核心/标题/扫描线/背景图。过渡期间锁输入 | ui-tools |
| `LevelNode` | 4 状态视觉 + 呼吸/脉冲动画 + 点击选中 + hover 缩放 | ui-tools |
| `LevelInfoCard` | 选中节点时显示标题+描述，内容切换淡入淡出 150ms | ui-tools |
| `StarfieldEffect` | Canvas Graphics 绘制 180 颗星点 + 20 个浮动数学符号 | level-select |
| `OrbitParticles` | 30 个绿色光点沿椭圆轨道运动，章节切换时涌向核心+批量重生 | ui-tools |
| `ScanSweep` | tween 驱动的绿色扫描线，章节切换时从上到下横扫 | ui-tools |

### 3.4 LevelDataManager 详细设计

```typescript
// 单例，同 SettingsManager 模式（static get instance()）
// 不挂节点，不跨场景持久

export class LevelDataManager {
    static get instance(): LevelDataManager;

    // 异步加载 chapters.json，返回 Promise
    load(): Promise<void>;

    // === 查询 ===
    getChapterCount(): number;
    getChapter(index: number): ChapterConfig;
    getLevelStatus(chapterIndex: number, localIndex: number): LevelStatus;
    getChapterProgress(chapterIndex: number): { completed: number; total: number };
    isChapterAccessible(chapterIndex: number): boolean;

    // === 进度（当前用 localStorage，未来接后端） ===
    setChapterCompleted(chapterIndex: number, count: number): void;
}
```

### 3.5 ChapterTransition 过渡时序控制

三段式过渡用 Promise 链驱动，确保阶段严格串行：

```typescript
async switchTo(targetChapterIndex: number): Promise<void> {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    await this._shutdown();       // Phase 1
    await this._reconfigure();    // Phase 2
    await this._bootup();         // Phase 3

    this.isTransitioning = false;
}
```

Phase 2 中先销毁旧节点再移除动画类，防止闪回。Phase 3 中最后节点入场完成后自动移除 entering 类。

### 3.6 关卡状态推导

```typescript
getLevelStatus(chapterIndex: number, localIndex: number): LevelStatus {
    const completed = this._configs.chapters[chapterIndex].completedCount;
    const i = localIndex;  // 0-indexed

    if (i < completed)                        return 'complete';
    if (i === completed || i === completed + 1)  return 'challengeable';
    if (i <= completed + 3)                   return 'unlocked';
    return 'locked';
}
```

---

## 四、跨场景传参流程

### 4.1 正向：level-select → battle

```
LevelSelectBootstrap
  └─ "进入关卡"按钮点击
      → SessionState.instance.selectedLevelId = node.globalId
      → SessionState.instance.currentChapterIndex = this._currentChapter
      → director.loadScene('battle')
      → BattleBootstrap.onLoad()
          → const id = SessionState.instance.selectedLevelId
          → if (!id) { /* 异常：无选中关卡，回退或报错 */ }
          → resources.load(`configs/levels/level-${id}`, ...)
          → 初始化战斗
```

### 4.2 反向：battle → level-select（返回恢复）

```
BattleBootstrap / BattleUI
  └─ "返回"按钮 / 战斗结束
      → director.loadScene('level-select')
      → LevelSelectBootstrap.onLoad()
          → // 正常初始化...
          → const savedChapter = SessionState.instance.currentChapterIndex
          → if (savedChapter && savedChapter !== 0) {
                this._switchToChapter(savedChapter); // 恢复到之前的章节
            }
          → // 可选：清除 SessionState.selectedLevelId（已消费）
```

---

## 五、场景节点树搭建

### 5.1 方式：混合搭建

- **编辑器静态层**：Canvas / Camera / 星空层 / 背景图 / 顶栏 / 底栏 / 容器节点（OrbitZone / LevelNodePool / ChapterIndicators）
- **代码动态层**：12 个 LevelNode / 4 个 ChapterDot / OrbitParticles 粒子池 / ScanSweep 扫描线
- Bootstrap 通过 `getChildByName` 取静态层引用，`new Node + addComponent` 创建动态层

### 5.2 节点树参考

```
Canvas (1920×1080)
├── BackgroundLayer                 # z: 0
│   ├── StarfieldCanvas             # Graphics 组件
│   ├── AiBgSprite                  # Sprite，screen 混合
│   ├── NoiseOverlay
│   ├── Vignette
│   └── Scanlines
├── TopBar (64px)                   # z: 20
│   ├── BtnBack
│   ├── ChapterTitle / TitleNo / TitleName
│   └── BtnSetting
├── ContentArea (820px)             # z: 10
│   └── OrbitZone (720px)
│       ├── OrbitRings              # 4 个椭圆 Sprite（静态）
│       ├── CoreOuter / CoreDot     # 静态
│       ├── ScanSweep               # 默认隐藏
│       ├── NavPrev / NavNext
│       ├── ChapterIndicators       # 容器，ChapterDot × 4 动态填充
│       ├── LevelNodePool           # 容器，LevelNode × 12 动态填充
│       └── InfoCard                # 右侧信息卡
└── BottomBar (80px)                # z: 20
    ├── StageLabel / ProgressBar / ProgressFill / ProgressPct
    └── BtnStart                    # "进入关卡"
```

---

## 六、背景图加载技术细节

- **加载方式**：`resources.load<SpriteFrame>(path, SpriteFrame)`，首次加载后缓存 Map 中
- **去重**：相同章节重复加载时直接读缓存，跳过网络/IO
- **混合模式**：Cocos 3.8.8 中 Sprite 无 `BlendType` 枚举，需直接设置：
  ```typescript
  sprite.srcBlendFactor = BlendFactor.ONE;
  sprite.dstBlendFactor = BlendFactor.ONE_MINUS_SRC_COLOR;
  ```
- **不透明度**：`sprite.color = new Color(255, 255, 255, 31)`（12% = 255×0.12 ≈ 31）
- **切换**：淡出 0.8s → 换图 → 淡入 0.8s（tween sprite.color 的 alpha 通道）
- **预加载（可选）**：hover 章节指示点时预加载目标背景图

---

## 七、实现检查清单

### 数据层
- [ ] `chapters.json` — 4 章 × 48 关，字段仅 name/description/recommendedFunctions
- [ ] `level-select-layout.json` — 坐标/轨道/时序/章节外观
- [ ] `LevelDataManager.ts` — 单例，加载 chapters + 状态推导 + 进度读写
- [ ] `SessionState.ts` — 纯 class 单例，selectedLevelId + currentChapterIndex
- [ ] 关卡状态推导逻辑正确（complete/challengeable/unlocked/locked）
- [ ] 关卡编号连续 1-48

### 视觉层
- [ ] 场景节点树搭建，与设计稿一致
- [ ] 4 种节点状态视觉渲染正确
- [ ] 轨道环 + 核心正常
- [ ] 星空 Canvas 粒子运行
- [ ] 轨道数据流粒子运行
- [ ] 背景图 Screen 混合 + 12% 不透明度

### 动画层
- [ ] 常驻动画全部运行（呼吸/脉冲/闪烁）
- [ ] 章节切换三段式过渡完整，无闪回
- [ ] 入场动画序列正确
- [ ] 背景图交叉淡入淡出正常

### 交互层
- [ ] 点击节点 → 信息卡更新
- [ ] 导航（箭头/指示点/键盘）正常，禁用规则正确
- [ ] 过渡期间输入锁定
- [ ] "进入关卡" → SessionState 写入 → loadScene('battle')
- [ ] battle → level-select 返回恢复章节

### 集成与兜底
- [ ] AudioManager / SettingsManager 集成
- [ ] SettingsPanel 弹窗正常
- [ ] 场景切换正常
- [ ] 兜底：level-{id}.json 加载失败时回退 level-select + Toast

### 平台适配
- [ ] PC 端 hover 效果正常
- [ ] 移动端触摸响应 + 节点/按钮尺寸适配
- [ ] Fit Width 缩放正常

---

## 八、开放问题

| # | 问题 | 状态 |
|---|------|------|
| 1 | 信息卡位置可能遮挡轨道右侧节点 — 需在 Cocos 中实际摆放后调整 | 待验证 |
| 2 | 需求文档 §3.4 背景层次（噪点/暗角/CRT 扫描线）在 Cocos 中的等效实现方案 | 待调研 |
| 3 | 进度持久化方案（localStorage 临时 → 后端 API） | 待定 |
| 4 | `level-{id}.json` 战斗内容数据结构 | 待战斗场景设计完定义 |
| 5 | 间章的叙事内容数据存储位置 | 待定 |
| 6 | BGM 是否在关卡选择场景切换 | 待定 |
| 7 | 背景图预加载策略是否实施 | 可选优化 |
