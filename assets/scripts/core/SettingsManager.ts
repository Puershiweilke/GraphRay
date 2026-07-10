import { EventTarget, sys } from 'cc';

// ======================== 类型 ========================

/** SettingItem 的元数据约束 */
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

// ======================== 值对象 ========================

/**
 * SettingItem —— 一个自洽的可观察设置项
 *
 * 自包含：值、默认值、元约束、存储 key、事件派发。
 * 加一个新设置项 = 在 SettingsManager 里加一行声明，零额外样板代码。
 *
 * 用法：
 *   static readonly bgmVolume = new SettingItem('bgm_vol', 0.7, { clamp: [0, 1] });
 *
 *   // 读
 *   SettingsManager.bgmVolume.value;        // number
 *   // 写（自动校验 + 持久化 + 派发）
 *   SettingsManager.bgmVolume.value = 0.5;
 *   // 订阅（类型推断 newVal/oldVal 为 number，不拼字符串）
 *   SettingsManager.bgmVolume.on((n, o) => {...}, this);
 *   // 重置
 *   SettingsManager.bgmVolume.reset();
 */
export class SettingItem<T = number> {
    private _value: T;
    private _et: EventTarget = new EventTarget();

    constructor(
        /** localStorage 存储键（不含前缀，Manager 会加前缀） */
        public readonly key: string,
        /** 默认值 */
        public readonly defaultValue: T,
        /** 元约束 */
        public readonly meta: SettingMeta<T> = {},
    ) {
        this._value = defaultValue;
    }

    /** 当前值 */
    get value(): T { return this._value; }
    set value(v: T) {
        v = this._applyMeta(v);
        if (v === this._value) return;
        const old = this._value;
        this._value = v;
        sys.localStorage.setItem(SettingsManager.STORAGE_PREFIX + this.key, this._serialize(v));
        console.log('[SettingsManager] 写入', this.key, '=', v);
        this._et.emit('change', v, old);
    }

    /** 订阅变化（回调签名 (newVal, oldVal) => void） */
    on(cb: (newVal: T, oldVal: T) => void, target?: any): void {
        this._et.on('change', cb, target);
    }

    /** 取消订阅 */
    off(cb: (newVal: T, oldVal: T) => void, target?: any): void {
        this._et.off('change', cb, target);
    }

    /** 重置为默认值（会触发 change 事件） */
    reset(): void {
        this.value = this.defaultValue;
    }

    /** 从 localStorage 恢复（由 Manager 在初始化时调用） */
    _load(): void {
        const fullKey = SettingsManager.STORAGE_PREFIX + this.key;
        const raw = sys.localStorage.getItem(fullKey);
        console.log('[SettingsManager] _load', this.key, 'raw:', raw);
        if (raw === null || raw === '') return;
        const parsed = this._deserialize(raw);
        console.log('[SettingsManager] _load', this.key, 'parsed:', parsed);
        if (parsed !== null) {
            this._value = this._applyMeta(parsed);
        }
    }

    // ==================== 内部 ====================

    private _applyMeta(v: T): T {
        // boolean 语义：强制转为布尔
        if (this.meta.boolean && typeof v !== 'boolean') {
            v = (!!v) as any;
        }
        // 枚举校验
        if (this.meta.enum && !this.meta.enum.includes(v)) {
            return this._value; // 非法值，拒绝写入
        }
        // 数值钳制
        if (this.meta.clamp && typeof v === 'number') {
            const [min, max] = this.meta.clamp;
            if (v < min) v = min as any;
            if (v > max) v = max as any;
        }
        // 自定义校验
        if (this.meta.validate && !this.meta.validate(v)) {
            return this._value; // 校验失败，拒绝写入
        }
        return v;
    }

    private _serialize(v: T): string {
        return String(v);
    }

    private _deserialize(raw: string): T | null {
        const dv = this.defaultValue;
        if (typeof dv === 'number') {
            const n = parseFloat(raw);
            return (isNaN(n) ? null : n) as T | null;
        }
        if (typeof dv === 'boolean') {
            return (raw === '1' || raw === 'true') as T;
        }
        // 字符串 / 枚举
        return raw as T;
    }
}

// ======================== 管理器 ========================

export class SettingsManager {
    private static _instance: SettingsManager | null = null;

    /** localStorage key 前缀 */
    static readonly STORAGE_PREFIX = 'gr_set_';

    private constructor() {
        // 初始化时加载所有声明项
        const items = SettingsManager._allItems();
        console.log('[SettingsManager] _allItems 数量:', items.length);
        for (const item of items) {
            item._load();
            console.log('[SettingsManager] 加载', item.key, '=', item.value);
        }
    }

    static getInstance(): SettingsManager {
        if (!SettingsManager._instance) {
            SettingsManager._instance = new SettingsManager();
        }
        return SettingsManager._instance;
    }

    // ======================== 设置项声明 ========================
    // 加新属性 = 加一行。零额外样板。

    /** BGM 音量 0~1（0 = 静音，无独立开关） */
    static readonly bgmVolume = new SettingItem('bgm_vol', 0.7, { clamp: [0, 1] });

    /** 音效音量 0~1（0 = 静音） */
    static readonly sfxVolume = new SettingItem('sfx_vol', 1.0, { clamp: [0, 1] });

    /** 语言：'zh' | 'en' */
    static readonly language = new SettingItem<'zh' | 'en'>('lang', 'zh', { enum: ['zh', 'en'] });

    // ======================== 批量操作 ========================

    /** 重置所有设置项为默认值 */
    static resetAll(): void {
        for (const item of SettingsManager._allItems()) {
            item.reset();
        }
    }

    /** 收集所有已声明的 SettingItem（自动扫描 static 属性） */
    private static _allItems(): SettingItem<any>[] {
        const items: SettingItem<any>[] = [];
        const proto = SettingsManager as any;
        for (const name of Object.getOwnPropertyNames(SettingsManager)) {
            const v = proto[name];
            if (v instanceof SettingItem) items.push(v);
        }
        return items;
    }
}
