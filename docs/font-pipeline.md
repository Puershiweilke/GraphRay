# GraphRay 字体系统 — 本地化双字体方案与子集化管线

> 关联：GDD.md §字体系统（本地化双字体方案）
> 创建日期：2026-07-09
> 状态：已落地，文档化

---

## 一、背景与动机

游戏需要两套字形观感：

- **拉丁 / 数字**：`Orbitron`（科幻感，用于章节编号、英文 UI、品牌字）。
- **中文 / 符号 / 数学字符**：需要一款清晰无衬线字体（章名、关卡名、弹窗文案、希腊字母等）。

但这里有三条坑，必须正面解决：

| 坑 | 现象 | 根因 |
|----|------|------|
| **Orbitron 无中文字形** | 中文绑 Orbitron → Web 端静默回退系统字体，Native 端直接变豆腐块 | Orbitron 是纯拉丁字体 |
| **系统字体不可控** | 玩家把系统字体换成花哨手写体 → 游戏全部中文变手写体，排版崩坏 | `label.fontFamily` 走字符串查找，缺字时回退到系统字体 |
| **文本随版本增长** | 新章名 / 新关卡 JSON / 新 UI 文案出现新字 → 子集字体缺字变方框 | 把字体"烤死"成当前字符串不具拓展性 |

结论：中文必须**本地化**（不依赖系统字体），且子集化必须**可重复、可校验、可拓展**。

---

## 二、方案选型（A vs B）

| 方案 | 做法 | 问题 |
|------|------|------|
| **A. 自托管 woff2 + `font-family`** | 把字体放 CDN/本地，CSS `font-family:'Orbitron',monospace` | 仍走 `font-family` 字符串查找链路，缺字会回退系统字体；仅是"默认偏好"而非"强制" |
| **B. Cocos Font 资源（采用 ✅）** | `resources.load('fonts/X', Font)` 加载为 `cc.Font`，直接 `label.font = 资源对象` | 直接引用资源对象，**完全不走 fontFamily 查找 → 绝不回退系统字体** |

**选 B 的理由**：

1. `label.font = 资源对象` 是硬绑定，用户换系统字体也影响不到游戏内文字。
2. 字体作为独立资源，浏览器/原生会单独缓存，JS 包不膨胀。
3. WebGL 与原生构建通用，不依赖 DOM/CSS 字体链路。
4. 相比 base64 内嵌到 JS，资源分离更利于缓存与增量更新。

> 关于带宽：Orbitron 仅 ~38KB，中文子集（已含 1113 字符）~278KB，一次性下载后全量缓存，对"服务器带宽有限"属可忽略量级。决策权重应放在**玩家侧可靠性（CN 网络 + 系统字体污染）**而非带宽。

---

## 三、双字体策略与 FontManager

统一入口：`assets/scripts/core/FontManager.ts`（core 基础设施，用户必须掌握）。

| 字形 | 资源 | 调用 |
|------|------|------|
| Latin（英文/数字） | `assets/resources/fonts/Orbitron.ttf` | `FontManager.attach(lbl)` |
| CJK（中文/符号/数学） | `assets/resources/fonts/NotoSansSC-Subset.ttf` | `FontManager.attachCJK(lbl)` |

**用法约定**：

1. 场景 Bootstrap 的 `onLoad`（建完所有 Label 之后）调用一次：
   ```typescript
   await FontManager.use(this.node);
   ```
   该调用会：① 先用 `fontFamily` 占位（乐观渲染）→ ② 并行加载两种字体资源 → ③ 加载完再统一套用（直接赋值 `label.font`）。
2. 运行时动态新建的 Label：
   - 纯拉丁/数字（如关卡编号）→ `FontManager.attach(lbl);`
   - 含中文/符号（章名/弹窗/文案）→ `FontManager.attachCJK(lbl);`
3. 静态 Label（场景里手摆的）若需中文，也需显式 `attachCJK`，否则保持原样不接管。

---

## 四、子集化管线 `tools/subset_cjk.py`

中文子集不是手敲字符集，而是一条**可重复运行**的管线。

### 4.1 工作原理

```
tools/subset_cjk.py
  ├─ 扫描 assets/ 下所有 .ts / .json
  ├─ 收集：全部可打印 ASCII（数字/英文/标点）
  │        + 全部非 ASCII 字符（中文/数学/希腊/符号）
  │        + EXTRA_SEED（预置常见 UI/数学符号）
  │        + tools/cjk_seed.txt（手工追加的未来用字）
  ├─ 加载 tools_base_fonts/NotoSansSC-VF.ttf（可变字体）
  ├─ 实例化为单字重（默认 wght=400）
  └─ 子集化输出 assets/resources/fonts/NotoSansSC-Subset.ttf
                 + 同款 .meta（importer: ttf-font，uuid 随机生成）
```

关键点：

- **扫描范围 = `assets/` 全部文本源**。章名、关卡 JSON、UI 文案里出现过的每一个非 ASCII 字符都会被收进去，保证"当前文本零缺字"。
- **ASCII 全量加入**：让"第3章""Lv.12"这类中英混排也能用单一 CJK 字体渲染（避免拉丁部分被 Orbitron 抢走又对不齐）。
- **跳过零宽变体选择符**（`U+FE00`–`U+FE0F`）：永不单独渲染，纳入子集无意义。

### 4.2 怎么跑（运行方式）

本机已配好 venv（fonttools 已装），直接：

```bash
# 生成 / 更新子集字体
C:/Users/xio_z/.workbuddy/binaries/python/envs/default/Scripts/python.exe tools/subset_cjk.py

# 仅校验覆盖，不写文件（发布前必跑）
C:/Users/xio_z/.workbuddy/binaries/python/envs/default/Scripts/python.exe tools/subset_cjk.py --check

# 调整字重后重生成（如想要更粗 UI 感，改 700 后重跑）
C:/Users/xio_z/.workbuddy/binaries/python/envs/default/Scripts/python.exe tools/subset_cjk.py --weight 700
```

通用环境（无预装 venv 时）：

```bash
# 1) 建隔离环境并装 fonttools
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install fonttools

# 2) 运行
python tools/subset_cjk.py                 # 生成
python tools/subset_cjk.py --check         # 校验
```

> ⚠️ 跑完后在 **Cocos Creator 中刷新 / 重导入 `assets/resources/fonts/`**，新字体才生效。

> ⚠️ **meta 格式坑（已踩）**：`ttf-font` 导入器的 `.meta` 中 `"files"` 必须是 `["ttf", "<名>.ttf"]`，**不是** `["json", ...]`。键写错会导致资源库没正确注册原生字体，`resources.load` 拿不到字体 → 回退系统字体，中文"看起来没变"。本管线已修正为 `.ttf`；若手动放字体，删掉 `.meta` 让 Cocos 重新生成最稳妥。

### 4.3 何时跑

| 时机 | 动作 |
|------|------|
| 新增/修改了任何含中文或特殊符号的 `.ts` / `.json` 文案后 | 跑 `subset_cjk.py` 重新生成 |
| 发布 / 出包前 | 必跑 `subset_cjk.py --check`，确认零缺字 |
| 想换中文字重（如更粗） | 跑 `subset_cjk.py --weight <wght>` |

### 4.4 安全网：`--check`

`--check` 会重新扫描项目、报告"项目里用了、但子集字体里没有"的字符，并明确告诉你重跑生成即可覆盖。这是"忘记重跑管线"时的兜底告警，发布前务必通过。

---

## 五、拓展机制（未来新增中文 / 符号）

管线设计成**自动 + 手动**双通道，确保"不烤死当前文案"：

1. **自动覆盖**：只要在 `.ts` / `.json` 里写了新字并保存，下次跑管线就会自动收进去。
2. **手工预置**（面向"未来可能用、但现在还没写进代码"的字）：
   - 编辑 `tools/cjk_seed.txt`，任意粘贴想要预置的文本，管线会一并纳入。
   - 或在 `subset_cjk.py` 的 `EXTRA_SEED` 常量里追加常见 UI/数学符号（已预置一批：标点、括号、希腊字母、数学符号、箭头等）。
3. **Noto 缺字处理**：部分装饰符号（如 ◈ ✕ 及带 `U+FE0F` 的 emoji 变体）Noto Sans SC 无字形。已在代码层约定替换为等价字形（`◈`→`◆`、`✕`→`×`），并把这类符号从 `EXTRA_SEED` 剔除，避免生成无意义的缺字告警。新增装饰符号时同理——优先用基础字体已覆盖的字形。

---

## 六、基础字体与忽略项

| 文件 | 说明 | 是否参与发布 |
|------|------|--------------|
| `tools_base_fonts/NotoSansSC-VF.ttf` | 子集化输入（17.7MB 可变字体） | ❌ 不参与，仅本地管线用 |
| `assets/resources/fonts/NotoSansSC-Subset.ttf` | 管线产物（~278KB） | ✅ 发布 |
| `assets/resources/fonts/Orbitron.ttf` | 拉丁字体（~38KB） | ✅ 发布 |

建议把 `tools_base_fonts/` 与 `.venv/` 加入 `.gitignore`（体积大、可由脚本/包管理器重建）。

---

## 七、故障排查

| 现象 | 排查 |
|------|------|
| `[错误] 找不到基础字体` | 下载 Noto Sans SC 可变 TTF 到 `tools_base_fonts/`（见脚本头部注释链接） |
| `--check` 报缺失字符 | 跑一次 `subset_cjk.py` 重新生成；若是未来用字，先加进 `cjk_seed.txt` |
| 中文变方框 | ① 是否漏跑管线；② 该 Label 是否调用了 `attachCJK`；③ 跑 `--check` 确认覆盖 |
| 中文变系统手写体 | 该 Label 不应走 `fontFamily` 查找——确认用 `label.font = 资源` 而非 `fontFamily`。FontManager 已规避此路径 |
| 字体改了不生效 | Cocos 未刷新资源——手动刷新/重导入 `assets/resources/fonts/` |
| `ModuleNotFoundError: fonttools` | 在运行环境装 `pip install fonttools`（推荐 venv 隔离） |

---

## 八、一句话总结

> **Orbitron（拉丁）+ Noto Sans SC 子集（中文）双字体，均本地 Font 资源硬绑定；中文子集由 `tools/subset_cjk.py` 扫描项目自动生成，发布前跑 `--check` 兜底。用户换系统字体也崩不了游戏。**
