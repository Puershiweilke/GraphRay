# GraphRay（函数射线）游戏设计文档

> 原型参考：GraphWar\
> 创建日期：2026-06-27\
> 文档版本：v0.10（2026-07-06：需求文档瘦身为纯效果/美术；新增开发方案 docs/level-select-dev-plan.md；决策 E/F 确立：SessionState 跨场景传参 + chapters 三文件分层）\
> 文档版本：v0.11（2026-07-09：确立字体策略=本地 Font 资源双字体，新增子集化管线 tools/subset_cjk.py，详见 `docs/font-pipeline.md`）

***

## 0. AI 阅读及使用原则

1. **本文档是框架性质文档**：只写摘要与进度，不写满实现细节。
2. **新增部件的细节**在 `docs/` 下新建独立 `.md` 撰写，GDD 中只引用路径（格式：「详见 `docs/xxx.md`」），方便按需查阅。
3. **分工**：用户掌握所有架构方向与关键决策，助手按指令编写代码/文档，不出格，不乱建。出代码前先对齐意图。
4. **代码分层原则**：`core/` = 框架骨架（用户必须完全掌握）；`ui-tools/` = 场景胶水代码 + 通用辅助组件（用户验收效果即可，不改架构）

***

## 1. 游戏概述

**GraphRay** 是一款基于数学函数表达式的多人对战 / 闯关游戏。\
玩家通过输入数学函数来控制射线的发射轨迹，利用函数图像的特性来攻击其他玩家或目标。

核心体验：**"用数学公式作为武器"** — 你写下的每一个函数，就是一道致命的射线。

***

## 2. 核心机制

### 2.1 射线发射

* 玩家输入一个数学函数（如 `y = sin(x)`、`y = x^2` 等）。

* 函数图像的**原点（0, 0）将被映射到玩家角色的位置，系统会在接收输入时做**手动修正，确保射线从角色身上射出，不发生偏移。

* 函数的作用域（定义域）决定了射线的起点和方向。

### 2.2 射线属性

| 属性       | 说明             |
| -------- | -------------- |
| **速度**   | 固定速度，不可变       |
| **持续时间** | 有限时间，超时后射线消失   |
| **可见性**  | 沿函数轨迹绘制，所有玩家可见 |

### 2.3 碰撞与伤害

| 碰撞类型      | 效果                          |
| --------- | --------------------------- |
| 击中玩家 / 目标 | 目标扣血，射线消失                   |
| 击中障碍物     | 射线消失，障碍物产生物理意义上的**缺口 / 破坏** |
| 击中场景边缘    | 射线消失                        |

### 2.4 胜利条件

* **闯关模式**：关卡内所有目标被击穿。

* **多人模式**：场上仅剩一名玩家存活。

***

## 3. 游戏模式

### 3.1 闯关模式（单人 / PvE）

* 关卡式推进，每关有预设的目标（静态靶子或 AI 敌人）。

* 可能包含地形 / 障碍物变化。

### 3.2 房间联机（多人 / PvP）

* 支持多人在线对战。

* 基于房间机制（创建 / 加入房间）。

* 最后存活的玩家获胜。

***

## 4. 认知负荷设计（待定）

基于教育理论中的**认知负荷理论（Cognitive Load Theory）**，考虑以下可选方案：

* **主动限制函数使用**：例如限制可用运算符、限制函数复杂度、限制定义域长度。

* **增加函数提示**：如预设函数模板、可视化的函数预览、函数库推荐。

* **分级解锁**：随着玩家熟练度提升，逐步解锁更复杂的函数类型。

> ⚠️ 此部分为待定设计，尚未决定是否实施。

***

## 5. 技术栈

| 层级       | 技术                         | 版本    |
| -------- | -------------------------- | ----- |
| 前端（游戏引擎） | Cocos Creator              | 3.8.8 |
| 前端语言     | TypeScript                 | —     |
| 后端框架     | Node.js + Express          | —     |
| 实时通信     | （待定：WebSocket / Socket.IO） | —     |
| 数据持久化    | （待定）                       | —     |

***

## 6. 项目结构

```
GraphRay/
├── assets/
│   ├── scripts/              # TypeScript 脚本
│   │   ├── core/             # 核心模块（AudioManager, AuthManager, LevelDataManager, PlatformDetector, SettingsManager）
│   │   ├── ui-tools/         # UI 胶水代码 + 通用辅助组件（ButtonHover, ButtonSfx, CardBackground, CursorStyle, GridBackground）
│   │   ├── level-select/     # 关卡选择场景组件（待开发）
│   │   └── main-menu/        # 主菜单 UI 组件（AboutPage, AudioPage, ExternalLink, FunctionWave, MainMenuBootstrap, RotatingTagline, SettingsPanel）
│   ├── scenes/               # 场景文件
│   │   ├── main-menu.scene   # 主菜单场景
│   │   └── level-select.scene # 关卡选择场景（待重建，见 §11）
│   ├── arts/
│   │   ├── textures/         # 贴图（标题图、按钮图标、章节背景图）
│   │   │   ├── mainmenu/     # 主菜单资源
│   │   │   └── selectLevel/  # 章节背景图（需移入 resources/ 才能动态加载）
│   │   ├── effects/          # 预留特效资源
│   │   ├── fonts/            # 预留字体资源
│   │   └── ui/               # 预留 UI 资源
│   ├── audios/               # 音频（neon_synthwave_drive.ogg）
│   ├── resources/            # 动态加载资源（resources.load 目录）
│   │   ├── configs/levels/
│   │   │   └── chapters.json # 关卡配置（4 章 × 48 关完整数据）
│   │   └── envelope.json     # 音频包络数据（驱动网格节拍同步）
│   ├── prefabs/              # 预留预制体
├── docs/                     # 项目文档
│   ├── backend-api.md        # 后端 API 规范
│   ├── comic-design.md       # 关卡漫画风格指南
│   ├── level-select-requirements.md  # 关卡选择界面需求档案（纯效果/美术，2026-07-06 瘦身）
│   ├── level-select-dev-plan.md      # 关卡选择界面开发方案（实现路径与原则）
│   ├── narrative-design.md   # 剧情/叙事设定文档
│   ├── settings-manager.md   # SettingsManager 架构文档
│   ├── ui-design-spec.md     # 主菜单 UI 设计规范
│   ├── update-envelope.md    # 更换 BGM 时更新包络数据的方法
│   └── font-pipeline.md      # 字体系统：本地化双字体方案 + 子集化管线（运行/校验/拓展）
│   └── ui预览/               # 主菜单 UI 预览 HTML
├── scripts/                  # 工具脚本
│   ├── generate_beats.py     # 包络提取脚本
│   ├── generate_gear_icon.py # 设置图标生成脚本（PIL 绘制，可调参）
│   ├── generate_level_select_scene.py  # LevelSelect.scene 生成脚本（⚠️ 生成的场景有 Bug，需修复或手动创建）
│   └── subset_cjk.py         # 中文子集化管线（扫描 assets/ 生成 NotoSansSC-Subset.ttf；详见 docs/font-pipeline.md）
├── tools_base_fonts/         # 子集化输入字体（不发布，建议 .gitignore）
├── profiles/                 # Cocos 编辑器配置
├── settings/                 # Cocos 项目设置
├── GDD.md
├── package.json
└── tsconfig.json
```

## 7. 平台兼容

### 7.1 分辨率策略

| 项目    | 设置                 |
| ----- | ------------------ |
| 设计分辨率 | 1920×1080（16:9 横屏） |
| 适配模式  | Fit Width（适配屏幕宽度）  |
| 手机方向  | 锁横屏（landscape）     |
| PC 体验 | 原生横屏，无需额外适配        |

> **决策理由**：GraphRay 核心玩法是"函数射线射击"，需要横向空间展示函数图像轨迹。1920×1080 + Fit Width 确保水平方向始终完整，不同比例屏幕的高度差异由 Cocos 自动处理。手机端锁横屏以统一 PC/移动端体验。

### 7.2 平台登录

| 平台        | 登录方式                           | 环境检测                        |
| --------- | ------------------------------ | --------------------------- |
| Web（个人网站） | `localStorage('zzyhub_token')` | 兜底默认                        |
| 微信小游戏     | `wx.login()` → 后端换 token       | `wx.createCanvas` 函数检测      |
| 抖音小游戏     | `tt.login()` → 后端换 token       | `tt.getSystemInfoSync` 函数检测 |
| 桌面（Steam） | `sys.localStorage`             | `sys.isNative` 检测           |

> 便捷判断：`PlatformDetector.isMiniGame` 一次判微信或抖音。详见 `assets/scripts/core/PlatformDetector.ts` 和 `assets/scripts/core/AuthManager.ts`。

## 8. 后端 API

登录接口 `POST /auth/login`，接收平台类型（wechat/douyin/web）和码值，返回 JWT（`zzyhub_token`）和用户信息。完整规范见 `docs/backend-api.md`。

***

## 9. 主菜单 UI

### 9.1 视觉设计

| 项目    | 规格                         |
| ----- | -------------------------- |
| 基准分辨率 | 1920×1080（横屏）              |
| 底色    | #1A1A1A                    |
| 信号色   | #9EFF00 荧光绿                |
| 中文字体  | Noto Sans SC 子集（本地 Font 资源，由 `tools/subset_cjk.py` 生成） |
| 英文/数字 | Orbitron（本地 Font 资源，硬绑定 `label.font`，不依赖系统字体） |
| 品牌链接  | zzyhub.cn（Share Tech Mono） |

> **字体系统（本地化双字体方案）**：详见 §9.4 与 `docs/font-pipeline.md`。核心原则——拉丁/数字用 Orbitron，中文/符号用 Noto Sans SC 子集，二者均本地 Font 资源硬绑定，**用户更换系统字体不影响游戏内文字**。中文子集随版本增长，由管线扫描 `assets/` 自动生成，发布前跑 `--check` 校验覆盖。

### 9.2 节点布局

> ⚠️ 坐标系：Canvas 中心 = (0,0)，X∈[-960,960]，Y∈[-540,540]。所有坐标均为 Canvas 局部坐标。
> 以下坐标已与 UI.scene 实际节点对齐（2026-07-01 校正）。

| 节点              | 位置 (X, Y)     | 说明                        |
| --------------- | ------------- | ------------------------- |
| GridBackground  | 全屏           | 网格底纹 + 音频节拍同步            |
| GraphsAnimation | (0, 368)      | 函数曲线轮播（840×140）          |
| Title           | (0, 180)      | 标题容器，子节点：title_han + title_en |
| TaglineCard     | (0, 68)       | 轮播文案（520×54）             |
| Buttons         | (0, -90)      | 按钮组容器                    |
| BtnChallenge    | (-220, 0)     | 闯关模式（200×160，Buttons 子节点）  |
| BtnRoom         | (0, 0)        | 加入房间（200×160，Buttons 子节点）  |
| BtnReward       | (220, 0)      | 每日奖励（200×160，Buttons 子节点）  |
| BtnSettings     | (0, -120)     | 设置栏（640×40，Buttons 子节点）    |
| IconSetting     | (-24, 0)      | 设置图标（24×24，BtnSettings 子节点） |
| Label           | (12, 0)       | "设置"文字（BtnSettings 子节点）   |
| Footter         | (0, -310)     | 页脚容器                      |
| FooterLink      | (0, 0)        | zzyhub.cn 链接（Footter 子节点）  |
| FooterCopyright | (0, -20)      | 版权信息（Footter 子节点）        |

### 9.3 组件清单

| 组件              | 文件                            | 功能                                  |
| --------------- | ----------------------------- | ----------------------------------- |
| FunctionWave    | `main-menu/FunctionWave.ts`   | 函数曲线轮播，10 个函数，3s 停留 + 1.5s morph 过渡 |
| GridBackground  | `ui-tools/GridBackground.ts`     | 网格底纹 + 音频节拍同步。主菜单专用，关卡选择界面不使用（轨道环已提供足够几何结构） |
| MainMenuBootstrap | `main-menu/MainMenuBootstrap.ts` | 主菜单场景入口脚本，挂 Canvas 节点，onLoad 时初始化 AudioManager + 播放主菜单 BGM + 创建设置面板并绑定 BtnSetting + 绑定 BtnChallenge 跳转关卡选择 |
| AudioManager    | `core/AudioManager.ts`        | 不灭根单例（game.addPersistRootNode），跨场景 BGM/SFX 管理，自动订阅 SettingsManager 音量。支持 switchBgm() 淡入淡出切换 |
| CardBackground  | `ui-tools/CardBackground.ts`     | 圆角卡片背景 + 荧光效果                       |
| ButtonHover     | `ui-tools/ButtonHover.ts`    | 悬停上浮 + 荧光 + 光标管理                    |
| ButtonSfx       | `ui-tools/ButtonSfx.ts`      | 按钮音效（hover 音 + click 音），与 ButtonHover 组合使用，独立职责 |
| CursorStyle     | `ui-tools/CursorStyle.ts`        | 非按钮节点的鼠标光标样式                        |
| ExternalLink    | `main-menu/ExternalLink.ts`   | 点击跳转外部链接，全平台兼容                      |
| RotatingTagline | `main-menu/RotatingTagline.ts` | 7 条点燃型文案 3s 轮播                      |
| SettingsPanel   | `main-menu/SettingsPanel.ts`  | 设置面板 Prefab 弹窗，标签页架构（音频与语言 / 关于），纯 Graphics 绘制 |
| AudioPage       | `main-menu/AudioPage.ts`      | 设置面板子页：BGM/SFX 音量滑块（点击拖拽）+ 语言切换（中文/English）+ 系统语言自动检测 |
| AboutPage       | `main-menu/AboutPage.ts`      | 设置面板子页：开发人员、引擎版本、资源来源及授权信息，纯展示无交互 |

> **设置管理**：`core/SettingsManager.ts` 单例，`SettingItem` 值对象方案。详见 `docs/settings-manager.md`。

### 9.4 字体系统（本地化双字体方案）

> 完整方案、管线运行方式与故障排查：详见 `docs/font-pipeline.md`

* **问题**：Orbitron 无中文字形；走 `font-family` 字符串查找会在缺字时静默回退系统字体（玩家换手写体→游戏崩）；中文文本随版本增长，不能烤死当前文案。
* **决策**：采用「Cocos Font 资源」方案（非 CDN、非 base64 内嵌）——`resources.load` 加载为 `cc.Font`，直接 `label.font = 资源对象`，**完全不走 fontFamily 查找 → 绝不回退系统字体**。
* **双字体**：拉丁/数字 → `Orbitron`（~38KB）；中文/符号/数学 → `Noto Sans SC` 子集（~278KB）。统一由 `core/FontManager.ts` 管理：`attach(lbl)` / `attachCJK(lbl)`，场景 Bootstrap `await FontManager.use(node)` 一步到位。
* **子集化管线**：`tools/subset_cjk.py` 扫描 `assets/` 下全部 `.ts`/`.json`，收集出现过的非 ASCII 字符 + 可打印 ASCII + 预置种子，实例化 Noto Sans SC 可变字体为单字重后子集化输出。
* **可拓展**：新增中文/符号后重跑管线即自动覆盖；`tools/cjk_seed.txt` 与脚本内 `EXTRA_SEED` 用于预置未来用字；`--check` 模式发布前校验零缺字。
* **基础字体**：`tools_base_fonts/NotoSansSC-VF.ttf`（子集化输入，不发布，建议 `.gitignore`）。

***

## 10. 音频

### 10.1 背景音乐

| 曲目                   | 来源                    | 许可  | 格式                 | 大小     |
| -------------------- | --------------------- | --- | ------------------ | ------ |
| Neon Synthwave Drive | Pixabay (alex-morgan) | CC0 | OGG 96kbps 22050Hz | 1.95MB |

### 10.2 节拍同步

* **方案**：离线分析 onset\_strength 包络 → 降采样 30Hz → `envelope.json`（120KB）

* **驱动**：`GridBackground` 每帧读取 `AudioManager.instance.currentTime`，插值包络值

* **效果**：强节拍时大格线加粗（1px→4px），弱节拍时小格线微动

* **平滑**：非对称低通（起音快 `attackFactor=0.8`，释音慢 `releaseFactor=0.3`）

* **更换 BGM**：见 `docs/update-envelope.md`

### 10.3 音频设置

* **方案**：齿轮按钮 → 通用设置面板（Prefab 可跨 scene 复用）
* **状态管理**：`SettingsManager` 单例（`SettingItem` 值对象方案）
* **持久化**：`MainMenuBootstrap.onLoad()` 中调用 `SettingsManager.getInstance()` 触发 localStorage 加载，在 `AudioManager` 之前执行。音量/语言均持久化。

***

## 11. 关卡选择界面

> 详见 `docs/level-select-requirements.md`（完整需求档案，纯效果/美术描述）
> 详见 `docs/level-select-dev-plan.md`（开发方案，含实现原则、数据模型、架构分层）

* **入口**：主菜单"闯关模式"按钮 → `LevelSelect.scene`
* **隐喻**：卫星轨道网络监控终端（4 条椭圆轨道 = 4 章，节点 = 能量卫星）
* **关卡**：4 章 × 12 关 = 48 关，全局连续编号
* **关卡类型**：A = 堆叠型（大量简单函数）、B = 精解型（少量复杂函数）
* **章节切换**：三段式过渡（停机 → 重构 → 启动），总时长 ~2.1s
* **数据驱动**：章节名、关卡列表、节点坐标、背景图路径等全部由 `assets/resources/configs/levels/chapters.json` 配置
* **HTML 原型**：`outputs/graphray-levelselect.html`
* **Ardot 设计稿**：`GraphRay-LevelSelect`（ID: `699900019329800`）

### 11.1 代码层进度（已回滚，待重建）

> ⚠️ 项目回滚后，以下脚本已不存在，需根据需求文档重新创建：

| 文件 | 层级 | 说明 |
|------|------|------|
| `core/LevelDataManager.ts` | core/ | ✅ 单例，加载 chapters.json + 状态推导（completedCount → 4 种状态）+ localStorage 进度读写 |
| `level-select/StarfieldEffect.ts` | level-select/ | 180 颗星点闪烁 + 数学符号上浮（Graphics 绘制） |
| `ui-tools/OrbitParticles.ts` | ui-tools/ | 椭圆轨道绿色光点粒子（30 个同时存在，支持涌向核心/批量重生） |
| `ui-tools/ScanSweep.ts` | ui-tools/ | 章节切换时的绿色扫描线（tween 驱动） |
| `ui-tools/LevelNode.ts` | ui-tools/ | 4 状态视觉（complete/challengeable/unlocked/locked）+ 呼吸/脉冲动画 + 点击选中 |
| `ui-tools/LevelInfoCard.ts` | ui-tools/ | 圆角信息卡片，内容切换淡入淡出 150ms |
| `ui-tools/ChapterTransition.ts` | ui-tools/ | 三段式过渡控制器（Shutdown→Reconfigure→Boot-up，Promise 驱动） |
| `ui-tools/LevelSelectBootstrap.ts` | ui-tools/ | 场景入口，onLoad 时构建全部 UI 节点（仿 SettingsPanel 模式） |

**数据配置**：
- ✅ `assets/resources/configs/levels/chapters.json` — 4 章 × 48 关完整数据（名称/描述/类型/坐标/轨道环/间章/过渡时序）
- ✅ `.meta` 已创建，UUID 可被 Cocos 识别

**重建注意事项**：
1. **Sprite BlendType**：Cocos Creator 3.8.8 中 Sprite 没有 `BlendType` 枚举，Screen 混合需用 `srcBlendFactor = 'ONE'` + `dstBlendFactor = 'ONE_MINUS_SRC_COLOR'` 直接设置
2. **UIOpacity**：用类引用 `addComponent(UIOpacity)` 而非字符串 `addComponent('cc.UIOpacity')`
3. **背景图加载**：章节背景图需移入 `resources/textures/selectLevel/` 目录，才能通过 `resources.load()` 动态加载

### 11.2 阻塞问题（待修复）

| # | 问题 | 状态 | 备注 |
|---|------|------|------|
| 1 | **关卡选择代码层已回滚** | 🔴 待重建 | 2026-07-06 校验：LevelDataManager.ts 不存在，chapters.json 目录为空。Step 0/1 均需从头重建。数据方案已调整：chapters（元数据）→ layout（布局）→ level-{id}（战斗内容）三文件分层 |
| 2 | ~~章节背景图位置错误~~ | ✅ 已解决 | 4 张图已落入 `resources/textures/level-select/`，`chapters.json` 中 `backgroundTexture` 字段已对齐为 `level-select/chapter-X-bg`（2026-07-04 修复） |
| 3 | **LevelSelect.scene 场景文件需重新配置** | 🟡 待做 | 当前场景引用的组件已缺失，需在 Cocos 编辑器中重新配置（按 §11.4 决策 B：混合搭建） |
| 4 | 移动端适配未实现 | ⚪ 待做 | 节点放大 48→64px，信息卡改底部弹窗 |
| 5 | "进入关卡"按钮无跳转目标 | ⚪ 待做 | 需战斗场景创建后接入 |

### 11.3 MainMenuBootstrap 集成状态

- ✅ **已绑定**：BtnChallenge 点击 → `director.loadScene('level-select')`
- ⚠️ **依赖**：需关卡选择场景和代码层重建完成后才能正常跳转

### 11.4 开发前架构决策

> 2026-07-04 确立 A/B/C/D 四项；2026-07-06 追加 E/F 两项。

| 决策点 | 选定方案 | 理由 / 实施要点 |
|--------|---------|---------------|
| **A. LevelDataManager 单例形态** | ① 纯 class 单例（同 `SettingsManager`） | 数据量小、无需挂节点、无需跨场景持久；进场景时 `resources.load` 异步加载即可，加载完成后通过回调/Promise 通知 Bootstrap 进入下一步 |
| **B. 场景节点树搭建方式** | ③ 混合：编辑器搭骨架 + 代码填充动态部分 | **编辑器静态层**：Canvas / Camera / 星空层 / 网格底纹层 / 章节背景图层 / 顶栏 / 底栏 / 章节指示点容器 / 关卡节点容器 / 粒子层 / 信息卡 / 扫描线层。**代码动态层**：12 个 LevelNode 实例 / 4 个 ChapterDot 高亮状态 / OrbitParticles 粒子节点池 / ScanSweep tween 节点。Bootstrap 通过 `getChildByName` 取静态层节点引用，再 `new Node` 填充动态层 |
| **C. ButtonHover / ButtonSfx 跨场景复用** | ✅ 已合并至 `ui-tools/` | 原 `scripts/ui/` 与 `scripts/tools/` 已合并为 `scripts/ui-tools/`（2026-07-06）。ButtonHover / ButtonSfx / CardBackground / CursorStyle / GridBackground 现统一收纳于 `ui-tools/`，作为"场景胶水代码 + 通用辅助组件"层，跨场景复用 |
| **D. 需求文档 §12 六个开放问题** | 已拆分 | 跨场景传参 → 决策 E；info-card 遮挡 / blur → 待验证；其余见 `level-select-dev-plan.md` §八 |
| **E. 跨场景传参** | 新建 `core/SessionState.ts` 纯模块单例 | 与 SettingsManager 职责分离：SettingsManager 管持久环境变量（音量/语言），SessionState 管会话临时态（selectedLevelId / currentChapterIndex）。不持久化，生命周期 = 一次游戏会话。同时为未来多人房间预留扩展（roomId / matchMode 等）。详见 `level-select-dev-plan.md` §2.4、§4 |
| **F. 关卡数据分层** | chapters.json + level-select-layout.json + level-{id}.json 三文件 | chapters.json 仅存关卡元数据（名称、描述）；level-select-layout.json 存场景布局参数（坐标、轨道、时序）；level-{id}.json 存战斗内容（待定义）。选择界面加载 chapters + layout，战斗场景按 selectedLevelId 加载对应 level-{id}.json。详见 `level-select-dev-plan.md` §2 |

### 11.5 建议开发顺序（依赖驱动）

```
Step 0  chapters.json（元数据） + level-select-layout.json（布局）   🔴 待重建
Step 0.5  core/SessionState.ts（会话状态单例）                       🔴 待创建
Step 1  core/LevelDataManager.ts                                  🔴 待重建
Step 2  level-select/ 三个特效（StarfieldEffect / OrbitParticles / ScanSweep） ← 独立可并行
Step 3  ui-tools/LevelNode.ts + ui-tools/LevelInfoCard.ts             ← 节点与信息卡视觉/状态/交互
Step 4  ui-tools/ChapterTransition.ts                           ← 三段式过渡，协调上面各件
Step 5  ui-tools/LevelSelectBootstrap.ts                        ← 集成入口，组装节点树+绑定
Step 6  level-select.scene 节点树搭建 + 编辑器配置         ← 配合决策 B 混合搭建
Step 7  联调：主菜单跳转 → 关卡选择 → 章节切换 → 进入关卡
```

***

## 12. 分工约定

| 角色          | 职责                                              |
| ----------- | ----------------------------------------------- |
| **你（项目主控）** | 掌握全部框架决策、所有关键方向性决定、掌握大部分细节。游戏成型过程中主导讨论。         |
| **我（开发辅佐）** | 按你的要求编写函数或部分代码文件；根据日志帮你定位问题，或直接检查代码；提供设计建议供你参考。 |

**原则**：

* 不做自作主张的架构决策。

* 不脱离你的指令擅自大范围构建。

* 出代码之前先对齐你的意图。

***

## 12. 发行与变现策略

### 12.1 目标平台

| 平台     | 状态  | 登录方式                               |
| ------ | --- | ---------------------------------- |
| 微信小游戏  | 计划中 | wx.login() → 后端换 token             |
| 个人导航网站 | 计划中 | 读网站下发的 zzyhub\_token（localStorage） |
| 抖音小游戏  | 待定  | tt.login()                         |
| Steam  | 待定  | Steamworks SDK                     |

> 个人主体可上架微信小游戏（¥30/年认证费），无需营业执照，但**不支持微信支付（IAP）**。

### 12.2 账号体系

* 当前：直接复用网站账号体系（`zzyhub_token` / `zzyhub_user`），微信平台另发专属 token。

* 未来独立账号：在当前 `AuthManager.init()` 前插入登录/注册 UI，后续流程不变。

### 12.3 广告策略

**原则：体验优先，广告必须有「隔离感」，只做玩家主动触发的激励视频广告。**

不采用 Banner（视觉噪音，降低游戏质感）和插屏（强制打断，留存风险高）。

| 广告类型 | 触发场景          | 触发方式   | 生效时机   |
| ---- | ------------- | ------ | ------ |
| 激励视频 | 闯关模式死亡后复活     | 玩家主动点击 | 通关第一关后 |
| 激励视频 | 卡关时获取函数提示     | 玩家主动点击 | 通关第一关后 |
| 激励视频 | 解锁射线颜色 / 轨迹特效 | 玩家主动点击 | 全程可用   |
| 激励视频 | 每日登录福利        | 玩家主动点击 | 全程可用   |

> **第一关内零广告投放**，保护玩家第一印象。

***

## 13. 待明确事项

以下内容可在后续迭代中补充：

* [ ] 射线函数的数学解析方案（表达式解析库选型）

* [ ] 函数可视化绘制的技术方案（Cocos Graphics / 自定义 Shader）

* [ ] 网络同步策略（帧同步 vs 状态同步）

* [ ] 障碍物破坏的物理表现

* [ ] 关卡编辑器 / 关卡数据格式

* [ ] 玩家角色移动方式（回合制？实时？）

* [ ] 函数输入 UI 设计

* [ ] 多人房间匹配流程

* [ ] 音效与视觉特效风格

* [ ] 认知负荷限制的具体规则（如决定实施）

