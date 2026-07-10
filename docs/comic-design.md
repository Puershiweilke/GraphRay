# GraphRay 关卡漫画风格指南

> 文档版本：v1.0  
> 创建日期：2026-06-30  
> 用途：AI 生图 prompt 依据 + 关卡漫画素材接入规范

---

## 1. 设计定位

关卡漫画承担"情绪导入"职责：在玩家进入关卡之前，用 1~3 格漫画建立对手形象、交代战场背景、点燃对抗情绪。

**核心矛盾共存**：主菜单是极简科技黑（#1A1A1A + 荧光绿），漫画是高对比度手绘风格。  
两者用**过渡动效**衔接：网格（GridBackground）在进入关卡时逐渐破碎，裂缝展开成漫画画格边框，视觉基因（荧光绿 `#9EFF00`）延续在漫画描边和速度线上。

---

## 2. 视觉风格

### 2.1 整体调性

| 维度 | 规格 |
|------|------|
| 风格参考 | 赛博朋克 × 日系少年漫 × 几何硬边 |
| 色调 | 高对比度；背景黑色/深灰；高光用 `#9EFF00` 荧光绿 |
| 线条 | 粗轮廓线（3~5px 等效），速度线密集，网点/半调肌理 |
| 阴影 | 硬阴影（无渐变），荧光绿局部发光描边 |
| 情绪词 | 紧张、热血、压迫感、反击感 |

### 2.2 画格布局规范

- **1 格**：单人大特写，传递关卡 Boss 的威压感
- **2 格**：左格（对手现身）+ 右格（主角视角/主角握笔特写），体现对峙张力
- **3 格**：起（场景交代）→ 承（对手挑衅）→ 转（主角爆发），叙事节奏最完整

画格边框线宽：`#9EFF00` 描边，4px 等效，直角切割（无圆角）。

### 2.3 对白气泡

- 矩形气泡，无尾巴，直角
- 气泡底色：`#000000` 或 `#1A1A1A`
- 文字：白色，加粗，字体感觉参考 Impact / 黑体压扁
- 荧光关键词：用 `#9EFF00` 高亮对白中的数学/武器词汇（如 `sin(x)`、`f(x)=∞`）

---

## 3. AI 生图 Prompt 模板

### 3.1 通用基底 Prompt（英文，适用所有关卡漫画）

```
manga panel, cyberpunk sci-fi style, high contrast black background, 
neon green (#9EFF00) outlines and speed lines, hard-edge shadows no gradients,
halftone texture, bold ink lines, dramatic perspective, 
character in a dark mathematical arena, intense battle atmosphere,
graphic novel style, clean panel border with neon green frame,
no watermark, no text
```

### 3.2 场景变体关键词

| 场景类型 | 追加关键词 |
|----------|-----------|
| Boss 大特写 | `extreme close-up face, glowing eyes, ominous expression, towering figure` |
| 对峙 | `two characters facing each other, tension, diagonal composition` |
| 公式攻击瞬间 | `glowing mathematical formula as projectile, light trail, impact flash` |
| 角色握笔/输入 | `hand holding glowing stylus, formula appearing in midair, focus shot` |
| 场景破坏 | `grid background shattering, debris, neon green crack lines` |

### 3.3 负向 Prompt（Negative Prompt）

```
watercolor, pastel, soft shadow, gradient background, rounded corners, 
speech bubble with tail, cute chibi, 3D render, photorealistic,
low contrast, desaturated, blurry, text overlay, logo
```

### 3.4 具体关卡 Prompt 示例

#### 关卡 1 引导关（主角初次觉醒）

```
manga panel, 2 panels layout, left panel: a dark empty math arena 
with coordinate grid floor, neon green grid lines, ominous atmosphere;
right panel: protagonist close-up, determined expression, 
hand writing formula on glowing blackboard, speed lines radiating outward,
cyberpunk neon green accent, high contrast black and white,
bold ink outline, halftone shadows, no watermark
```

#### Boss 关卡（压迫感登场）

```
manga panel, single large panel, imposing villain character 
standing on a shattered coordinate grid, towering over viewer,
neon green glowing mathematical symbols surrounding them,
deep shadows, dramatic upward angle shot,
speed lines converging on villain, halftone texture,
neon green outline frame, cyberpunk manga style,
high contrast black background, no watermark
```

#### 最终对决（双方爆发）

```
manga panel, 3 panels layout, 
top panel: wide shot of arena with two opposing players,
middle panel: extreme close-up eyes of both characters,
bottom panel: two glowing formula beams colliding in the center,
explosion of neon green light, speed lines, debris,
cyberpunk manga style, high contrast, halftone texture,
bold ink lines, no watermark
```

---

## 4. 角色设定草案

> 以下角色设定用于保持各关卡漫画的角色一致性。

### 4.1 主角

| 项目 | 描述 |
|------|------|
| 外形 | 中性偏男，学生/青年感，头发略乱 |
| 服装 | 深色连帽衫，袖口有荧光绿线条装饰 |
| 标志动作 | 在空中写公式（发光手势） |
| 表情谱 | 专注（默认）、爆发（愤怒/热血）、震惊 |
| AI 生图关键词 | `young protagonist, dark hoodie with neon green trim, focused expression, glowing formula gesture` |

### 4.2 典型 Boss 形态参考

| Boss 类型 | 外形关键词 |
|-----------|-----------|
| 机械型 | `robotic enemy, exposed circuits, neon green visor, mechanical arms` |
| 学院派精英 | `smug scholar villain, formal dark uniform, floating formula halo` |
| 混沌型 | `chaotic figure, fragmented body, mathematical symbols orbiting body` |

---

## 5. 游戏内接入规范

### 5.1 素材规格

| 参数 | 规格 |
|------|------|
| 分辨率 | 1080×608（16:9，适配 1920×1080 弹窗） |
| 格式 | PNG（支持透明）或 WebP（压缩优先） |
| 色彩空间 | sRGB |
| 文件大小 | 单张 ≤ 300KB（WebP 压缩后） |

### 5.2 Cocos Creator 接入方式

```
assets/
└── arts/
    └── comics/
        ├── chapter01/
        │   ├── panel_01.webp    # 关卡 1-1 前置漫画
        │   └── panel_02.webp
        ├── chapter02/
        └── ...
```

**加载方式**：通过 `resources/` 目录动态加载，避免打包体积过大：

```typescript
// 加载关卡漫画
resources.load(`comics/chapter01/panel_01`, SpriteFrame, (err, spriteFrame) => {
    if (!err) {
        this.comicSprite.spriteFrame = spriteFrame;
    }
});
```

### 5.3 漫画展示 UI 设计要点

- **弹窗尺寸**：1080×608，居中，背景蒙版（`rgba(0,0,0,0.85)`）
- **边框**：`#9EFF00` 2px 描边，直角（`borderRadius: 0`）
- **出场动效**：从黑色蒙版中"裂开"展现（GridBackground 破碎动效过渡）
- **翻页控制**：底部进度点（荧光绿填充 = 已看，灰色 = 未看），右下角"开始战斗"按钮
- **跳过按钮**：右上角，透明文字"跳过 >"，颜色 `#666666`

### 5.4 过渡动效方案（GridBackground → 漫画）

**进入流程**：
1. 玩家点击"开始关卡"
2. GridBackground 线宽突然爆发（envelope 强制拉满 1.0）
3. 网格线从中心向四周扩散，透明度逐渐降低
4. 扩散线条"断裂"，形成漫画画格的矩形边框
5. 画格内容（漫画图片）淡入

**实现思路**：
```typescript
// GridBackground 提供 triggerBreak() 方法
// ComicPanel 监听 GridBackground 的 onBreakComplete 事件
// 两个组件通过 EventTarget 解耦通信
```

---

## 6. 文案配合

漫画中的对白文字（若 AI 无法直接生成理想效果，可后期合成）参考：

| 情景 | 对白文本 |
|------|---------|
| Boss 出场 | "你以为，方程式能伤害我？" |
| 主角爆发 | "f(x) = 你的终点。" |
| 决战前 | "这道题，只有一个答案。" |
| 主角输入公式 | "…我来定义这个世界的规则。" |
| 胜利后 | "证毕。" |

---

## 7. 版权与许可

- AI 生成图像：使用 Stable Diffusion / Midjourney 等工具生成，**商用前确认平台许可协议**（SD 本地生成无版权问题；Midjourney 需 Pro 订阅方可商用）。
- 建议工具：**Stable Diffusion + ControlNet（漫画线稿控制）**，本地运行，无版权风险。
- 图像后处理：Photoshop / Aseprite 手动添加对白气泡和荧光描边。
