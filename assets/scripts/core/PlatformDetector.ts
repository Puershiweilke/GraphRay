/**
 * PlatformDetector.ts
 * 运行环境检测 —— 判断当前游戏跑在哪个平台
 *
 * 原理：各小游戏平台会向全局注入专属对象。
 *       用平台专属 API 判断（而非仅判断对象存在），避免误判。
 */

import { sys } from 'cc';

/** 支持的平台枚举 */
export enum Platform {
    /** 微信小游戏 */
    Wechat = 'wechat',
    /** 抖音小游戏 */
    Douyin = 'douyin',
    /** 原生桌面（Windows/Mac/Linux），含 Steam */
    Desktop = 'desktop',
    /** Web 浏览器（个人网站） */
    Web = 'web',
}

/**
 * 平台检测器
 * 全局只需检测一次，结果缓存。
 */
export class PlatformDetector {
    private static _platform: Platform | null = null;

    /** 检测当前平台（结果会被缓存） */
    static detect(): Platform {
        if (this._platform !== null) return this._platform;

        const g: any = globalThis;

        // 1. 微信小游戏：wx.createCanvas 仅微信小游戏有，微信浏览器没有
        if (typeof g.wx?.createCanvas === 'function') {
            this._platform = Platform.Wechat;
            return this._platform;
        }

        // 2. 抖音小游戏：tt 是字节跳动小游戏 SDK 的全局对象
        if (typeof g.tt?.getSystemInfoSync === 'function') {
            this._platform = Platform.Douyin;
            return this._platform;
        }

        // 3. 原生桌面（含 Steam 发行版）—— 用 Cocos sys 模块判断
        //    sys.isNative 在原生构建时为 true，浏览器/小游戏为 false
        if (sys.isNative) {
            this._platform = Platform.Desktop;
            return this._platform;
        }

        // 4. 其余一律视为 Web
        this._platform = Platform.Web;
        return this._platform;
    }

    /** 是否微信小游戏环境 */
    static get isWechat(): boolean {
        return this.detect() === Platform.Wechat;
    }

    /** 是否抖音小游戏环境 */
    static get isDouyin(): boolean {
        return this.detect() === Platform.Douyin;
    }

    /** 是否原生桌面环境（含 Steam） */
    static get isDesktop(): boolean {
        return this.detect() === Platform.Desktop;
    }

    /** 是否 Web 浏览器环境 */
    static get isWeb(): boolean {
        return this.detect() === Platform.Web;
    }

    /** 是否移动端小游戏（微信/抖音等，方便批量判断） */
    static get isMiniGame(): boolean {
        const p = this.detect();
        return p === Platform.Wechat || p === Platform.Douyin;
    }
}
