# GraphRay（函数射线）

> 一款以**数学函数**为核心武器的游戏 —— 你写下的每一个函数，就是一道致命的射线。
> Built with **Cocos Creator 3.8.8** · **TypeScript** · **Node.js/Express** · **Python 工具链**

---

## ✨ 项目简介

GraphRay 是一款基于数学函数表达式的闯关 / 对战游戏原型。玩家通过输入数学函数（如 `y = sin(x)`、`y = x²`）来控制射线的发射轨迹，利用函数图像的特性攻击目标或对手。

- **核心体验**：「用数学公式作为武器」——函数图像的原点映射到角色位置，射线沿函数曲线射出，击中目标扣血、击中障碍物产生缺口、击中边缘消失。
- **当前状态**：原型开发中（prototype）。已完成主菜单、轨道式关卡选择、关卡解锁链路、双字体自托管与中文字子集化管线等核心系统；战斗关卡内容（障碍物 / 敌人 AI）仍在按设计文档逐步填充。

> 设计全貌见 [`GDD.md`](./GDD.md)；各部件细节在 [`docs/`](./docs) 下独立成篇。

---

## 🎮 核心玩法

| 机制 | 说明 |
| --- | --- |
| **函数射线** | 玩家输入数学函数，系统以其图像作为射线轨迹；曲线上有序排布的"波峰/波谷"成为战术资源。 |
| **射线属性** | 固定速度、有限持续时间、沿轨迹绘制且全员可见。 |
| **碰撞与伤害** | 击中玩家/目标 → 扣血；击中障碍物 → 产生缺口/破坏；击中场景边缘 → 消失。 |
| **胜利条件** | 闯关模式击穿全部目标；多人模式场上仅剩一名存活。 |

关卡按「教学 → 基础 → 进阶 → 挑战 → Boss」五阶进阶，配合 4 类障碍物（墙壁 / 镜面 / 吸收体 / 移动屏障）与 4 类敌人（固定炮台 / 追踪者 / 护盾敌人 / 函数法师），逼迫玩家使用不同类型的函数解题。

---

## 🧰 技术栈

| 层 | 技术 |
| --- | --- |
| 游戏引擎 | Cocos Creator 3.8.8（WebGL 构建，网页可直接运行） |
| 前端语言 | TypeScript |
| 后端（联机/存档） | Node.js + Express |
| 美术 / 工具链 | Python（程序化生成节拍图、齿轮图标、关卡场景；中文字体子集化） |
| 字体 | 本地自托管双字体（Orbitron 拉丁 + Noto Sans SC 中文子集），不依赖外部 CDN |

---

## 🏗️ 架构亮点（简历可讲的点）

1. **数据驱动关卡系统**：`chapters.json`（元数据）+ `level-select-layout.json`（布局）+ `level-{id}.json`（战斗内容）三文件分层，关卡位置 / 解锁状态全部由数据驱动，不硬编码数量。
2. **中文字体子集化自托管**：`tools/subset_cjk.py` 扫描 `assets/` 下全部源码与 JSON 的中文，子集化生成 ~278KB 字体，**可重复运行**并带 `--check` 覆盖校验。彻底规避国内网络下 Google Fonts 静默回退系统字体的坑。详见 [`docs/font-pipeline.md`](./docs/font-pipeline.md)。
3. **轨道式关卡选择 UI**：把关卡选择隐喻为「卫星轨道网络监控终端」—— 4 条椭圆轨道 = 4 章，节点 = 能量卫星，背景圆弧 = 全局进度环。详见 [`docs/level-select-requirements.md`](./docs/level-select-requirements.md) 与 [`docs/level-select-dev-plan.md`](./docs/level-select-dev-plan.md)。
4. **解锁链路逻辑**：通关 N → 解锁 N+1 与 N+2；章末 Boss 设门禁。定位全部基于 `levels[]` 动态范围，消除了早期硬编码 `Math.floor((id-1)/12)` 与动态口径不一致的隐式假设。
5. **开发期护栏**：`LevelDataManager` 在 `CC_DEBUG` 下校验「`completed:true` 但战斗文件缺失 / 反之」的不一致，给出明确警告，把数据错误挡在运行前。
6. **程序化美术**：`scripts/` 下 Python 脚本生成节拍图、齿轮图标、关卡场景，减少手工美术依赖。

---

## 📁 目录结构（概览）

```
GraphRay/
├── assets/
│   ├── scripts/
│   │   ├── core/          # 框架骨架（单例/会话状态/字体管理器等）
│   │   ├── ui-tools/      # 场景胶水 + 通用辅助组件
│   │   ├── main-menu/     # 主菜单专属组件
│   │   └── level-select/  # 关卡选择场景专属组件
│   └── resources/         # 配置、字体、纹理
├── docs/                  # 设计文档（GDD 引用的细节篇）
├── tools/                 # 中文字体子集化等工具
├── scripts/               # 程序化美术 / 场景生成 Python 脚本
├── GDD.md                 # 游戏设计文档（框架级）
└── package.json
```

代码分层原则：`core/` = 用户必须完全掌握的框架；`ui-tools/` = 场景胶水（验收效果即可）。详见 [`GDD.md`](./GDD.md) 第 0 节。

---

## 🚀 运行与构建

### 编辑器运行
用 **Cocos Creator 3.8.8** 打开本工程，直接预览 `main-menu` / `level-select` 场景。

### Web 构建（命令行）
```bash
# 在 Cocos Creator 安装目录下调用编辑器进行无头构建
CocosCreator.exe --project "<工程路径>" --build "platform=web-mobile"
# 产物位于 build/web-mobile/，_static/index.html 可直接静态托管
```

### 后端（联机 / 存档，可选）
```bash
npm install
npm start          # 启动 Express 服务，接口约定见 docs/backend-api.md
```

---

## ▶️ 在线试玩

> 游戏仍在开发中。完成并部署到正式服务器后，将在此提供 WebGL 试玩链接。

> 提示：网页游戏建议用桌面浏览器打开，以获得最佳交互与性能。

---

## 📚 文档索引

| 文档 | 内容 |
| --- | --- |
| [`GDD.md`](./GDD.md) | 游戏设计总纲（框架级，摘要 + 进度） |
| [`docs/font-pipeline.md`](./docs/font-pipeline.md) | 双字体自托管 + 中文字子集化管线 |
| [`docs/level-select-requirements.md`](./docs/level-select-requirements.md) | 关卡选择界面需求（效果 / 美术） |
| [`docs/level-select-dev-plan.md`](./docs/level-select-dev-plan.md) | 关卡选择界面开发方案（架构 / 流程） |
| [`docs/narrative-design.md`](./docs/narrative-design.md) | 后默示录世界观与叙事 |
| [`docs/backend-api.md`](./docs/backend-api.md) | 后端接口约定 |
| [`docs/ui-design-spec.md`](./docs/ui-design-spec.md) | UI 设计规范 |
| [`docs/settings-manager.md`](./docs/settings-manager.md) | 设置管理器设计 |
| [`docs/comic-design.md`](./docs/comic-design.md) | 短篇漫画《默念》设计 |

---

## 📝 设计决策与踩坑（节选）

- **函数射线 = 图像武器**：射线不从玩家"修正"射出，而是把函数图像原点映射到角色位置，玩家用常数项做垂直偏移作为战术资源 —— 而非把误差藏起来。
- **分辨率适配**：设计基准 1920×1080，用 `ResolutionPolicy.SHOW_ALL` 整块可见（contain），HUD 角标用 `Widget` 钉角落，避免裁切。
- **Cocos 陷阱沉淀**：动画 tween 目标若为非节点对象（如裸 `Color`），场景销毁后引擎不会自动停，残留每帧写已销毁组件会触发 `equals(null)` 崩溃 —— 已沉淀为可复用经验。

---

## 📄 许可证

[MIT](./LICENSE) © 2026 ZZY

> 仓库用于作品集展示与学习交流。如需商用或大剂量借鉴，欢迎先开个 issue 聊聊。
