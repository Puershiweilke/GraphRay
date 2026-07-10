# SettingsManager 架构文档

> 关联代码：`assets/scripts/core/SettingsManager.ts`  
> 创建日期：2026-07-01

---

## 设计目标

**第一原则：拓展内部属性的方便性和可理解性。**

旧方案（扁平属性 + 专用 getter/setter）的问题：

- 加一个属性要改 7 处（key 常量、默认值、私有字段、getter/setter、`_load`、`getSnapshot`、`resetToDefaults`）
- clamp / 存储 / emit 逻辑在每个属性的 setter 里重复写
- 事件名是字符串，易拼错
- 理解一个属性要读散落在 5 处的代码

## 解决方案：SettingItem 值对象

把"一个设置项"抽象成一个自洽的值对象。所有通用逻辑（校验、钳制、持久化、事件派发）封装在 `SettingItem<T>` 内部写一次。Manager 只负责声明和批量扫描。

### 加一个新属性 = 一行声明

```typescript
static readonly bgmVolume = new SettingItem('bgm_vol', 0.7, { clamp: [0, 1] });
```

### 使用方式

```typescript
// 读（类型推断为 number）
const v = SettingsManager.bgmVolume.value;

// 写（自动校验 + 持久化 + 派发）
SettingsManager.bgmVolume.value = 0.5;

// 订阅（按属性，不拼字符串事件名，类型推断 newVal/oldVal）
SettingsManager.bgmVolume.on((newVal, oldVal) => {
    this.audioSource.volume = newVal;
}, this);

// 重置为默认值
SettingsManager.bgmVolume.reset();

// 批量重置
SettingsManager.resetAll();
```

### 代价

访问多一层 `.value`。这是前端领域标准的"信号盒"模式（Vue 的 ref、Solid 的 signal），明确传达"这是一个可观察的值"，可理解性比裸赋值更强。

## SettingMeta 约束类型

```typescript
export interface SettingMeta<T> {
    /** 数值范围钳制 [min, max] */
    clamp?: [number, number];
    /** 枚举允许值 */
    enum?: readonly T[];
    /** 布尔语义（值为 true/false 时启用，等价于开关） */
    boolean?: boolean;
    /** 自定义校验，返回 false 则拒绝写入（回退到旧值） */
    validate?: (v: T) => boolean;
}
```

| 约束 | 用途 | 示例 |
|------|------|------|
| `clamp` | 数值范围钳制 | `{ clamp: [0, 1] }` — 音量 |
| `enum` | 枚举允许值 | `{ enum: ['zh', 'en'] }` — 语言 |
| `boolean` | 布尔语义（等价于开关） | `{ boolean: true }` — 屏幕震动开关 |
| `validate` | 自定义校验 | `{ validate: v => v === 0 || v === 0.5 || v === 1 }` |

### 约束处理顺序

写入时按以下顺序应用 meta：

1. `boolean` — 强制转为布尔
2. `enum` — 非法值拒绝写入
3. `clamp` — 数值钳制到范围
4. `validate` — 自定义校验失败拒绝写入

任何一步拒绝写入，value 保持旧值不变。

## 当前已声明的设置项

```typescript
static readonly bgmVolume = new SettingItem('bgm_vol', 0.7, { clamp: [0, 1] });
static readonly sfxVolume = new SettingItem('sfx_vol', 1.0, { clamp: [0, 1] });
static readonly language = new SettingItem<'zh' | 'en'>('lang', 'zh', { enum: ['zh', 'en'] });
```

## 存储约定

- 所有 key 统一加前缀 `gr_set_`（由 `SettingItem` 写入时拼接）
- 序列化：number → `String(v)`，boolean → `'1'`/`'0'`，string → 原样
- 反序列化：按 defaultValue 类型推断

## 初始化时序

```
SettingsManager.getInstance()  ← 第一次调用
  └─ constructor()
       └─ _allItems()  扫描 static 属性，收集所有 SettingItem 实例
            └─ 对每个 item 调用 _load()，从 localStorage 恢复
```

`_allItems()` 通过 `Object.getOwnPropertyNames(SettingsManager)` 反射扫描，自动发现所有 `static readonly` 的 `SettingItem` 实例。加新属性无需注册，自动被纳入批量加载和批量重置。

## 功能模块订阅范式

各模块在自己的 `onLoad` 里订阅，`onDestroy` 里取消订阅（如果模块会被销毁）：

```typescript
import { SettingsManager } from '../core/SettingsManager';

onLoad() {
    // 初始化时应用当前值
    this.audioSource.volume = SettingsManager.bgmVolume.value;
    // 订阅后续变化
    SettingsManager.bgmVolume.on(this._onBgmVol, this);
}

onDestroy() {
    SettingsManager.bgmVolume.off(this._onBgmVol, this);
}

private _onBgmVol(newVal: number) {
    this.audioSource.volume = newVal;
}
```

> 单例性质的 Manager 不会销毁，订阅的 target 指向组件实例。如果组件可能被销毁且未取消订阅，EventTarget 会持有 target 引用导致内存泄漏。**长生命周期组件可以不 off；会销毁的组件必须 off。**

## 未来扩展候选

加新设置项不改架构，加一行声明：

| 类别 | 候选项 | 示例声明 |
|------|--------|---------|
| 画面 | 节拍同步开关 | `new SettingItem('beat_sync', true, { boolean: true })` |
| 画面 | 减少动效 | `new SettingItem('reduce_motion', false, { boolean: true })` |
| 画面 | 屏幕震动 | `new SettingItem('screen_shake', true, { boolean: true })` |
| 画面 | 画质档位 | `new SettingItem('quality', 'high', { enum: ['low', 'med', 'high'] })` |
| 操作 | 瞄准灵敏度 | `new SettingItem('aim_sens', 0.5, { clamp: [0.1, 1] })` |
| 游戏性 | 难度 | `new SettingItem('difficulty', 'normal', { enum: ['easy', 'normal', 'hard'] })` |
| 无障碍 | 色盲模式 | `new SettingItem('colorblind', false, { boolean: true })` |
| 账号 | 录屏开关 | `new SettingItem('replay', true, { boolean: true })` |
