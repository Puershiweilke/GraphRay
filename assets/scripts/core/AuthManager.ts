/**
 * AuthManager.ts
 * 统一登录管理器（单例）
 *
 * 职责：登录态存取、token 校验、屏蔽平台差异。
 * 不负责 UI（弹窗、跳转等），UI 层由调用方单独控制。
 *
 * 平台差异：
 *   Web     → localStorage 里的 zzyhub_token / zzyhub_user
 *   Wechat  → wx.login() → code → 后端换 token → wx.Storage
 *   Douyin  → tt.login()  → code → 后端换 token → tt.Storage
 *   Desktop → sys.localStorage，与 Web 同源策略（Steam 发行版）
 */

import { PlatformDetector, Platform } from './PlatformDetector';
import { sys } from 'cc';

// ======================== 类型定义 ========================

/** 用户信息 */
export interface UserInfo {
    id: number;
    email: string;
    nickname: string;
    avatar_url: string | null;
    created_at: string;
}

/** JWT Payload 结构 */
interface JwtPayload {
    userId: number;
    iat: number;
    exp: number;
}

/** 登录结果 */
export interface LoginResult {
    success: boolean;
    user?: UserInfo;
    error?: string;
}

// ======================== 管理器 ========================

export class AuthManager {
    private static _instance: AuthManager | null = null;

    private token: string | null = null;
    private user: UserInfo | null = null;

    // 存储 key（Web/Desktop 用 zzyhub 统一 key，小游戏用独立 key）
    private static readonly MINIGAME_TOKEN_KEY = 'graphray_token';
    private static readonly MINIGAME_USER_KEY  = 'graphray_user';

    private apiBase: string = '';

    private constructor() {}

    // ======================== 对外 API ========================

    static getInstance(): AuthManager {
        if (!AuthManager._instance) {
            AuthManager._instance = new AuthManager();
        }
        return AuthManager._instance;
    }

    setApiBase(url: string): void {
        this.apiBase = url;
    }

    /** 初始化：从本地存储恢复登录态 */
    async init(): Promise<LoginResult> {
        const p = PlatformDetector.detect();
        if (p === Platform.Wechat || p === Platform.Douyin) {
            return this.restoreMiniGame(p);
        }
        // Web / Desktop：统一走 localStorage / sys.localStorage
        return this.restoreWebOrDesktop();
    }

    /**
     * 主动登录（小游戏环境才需要）
     *   Wechat → wx.login() → 后端换 token
     *   Douyin → tt.login()  → 后端换 token
     *   Web/Desktop → 不用调（token 由网站下发）
     */
    async login(): Promise<LoginResult> {
        const p = PlatformDetector.detect();
        switch (p) {
            case Platform.Wechat:
                return this.doWechatLogin();
            case Platform.Douyin:
                return this.doDouyinLogin();
            default:
                return { success: false, error: '请通过网站登录' };
        }
    }

    /** 登出 */
    logout(): void {
        this.token = null;
        this.user  = null;

        const p = PlatformDetector.detect();
        if (p === Platform.Wechat || p === Platform.Douyin) {
            const g: any = globalThis;
            const api = p === Platform.Wechat ? g.wx : g.tt;
            try {
                api.removeStorageSync(AuthManager.MINIGAME_TOKEN_KEY);
                api.removeStorageSync(AuthManager.MINIGAME_USER_KEY);
            } catch { /* 忽略 */ }
        }
    }

    getUser(): UserInfo | null { return this.user; }
    getToken(): string | null { return this.token; }

    isTokenValid(): boolean {
        if (!this.token) return false;
        const payload = decodeJWT(this.token);
        if (!payload) return false;
        return payload.exp > nowSeconds();
    }

    // ======================== 存储工具 ========================

    /** 小游戏获取存储 API 对象（wx 或 tt） */
    private getStorageAPI(): any {
        const p = PlatformDetector.detect();
        const g: any = globalThis;
        if (p === Platform.Wechat) return g.wx;
        if (p === Platform.Douyin) return g.tt;
        return null;
    }

    /** Web/Desktop 写入 token（兼容 native 无 localStorage） */
    private setBrowserStorage(key: string, value: string): void {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, value);
        } else {
            sys.localStorage.setItem(key, value);
        }
    }

    /** Web/Desktop 读取 token */
    private getBrowserStorage(key: string): string | null {
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem(key);
        }
        return sys.localStorage.getItem(key);
    }

    // ======================== 平台私有实现 ========================

    /** Web / Desktop：从 localStorage 恢复 */
    private restoreWebOrDesktop(): LoginResult {
        const token   = this.getBrowserStorage('zzyhub_token');
        const userStr = this.getBrowserStorage('zzyhub_user');

        if (!token || !userStr) {
            return { success: false, error: '未找到登录信息' };
        }

        const payload = decodeJWT(token);
        if (!payload) {
            return { success: false, error: 'token 格式异常' };
        }
        if (payload.exp <= nowSeconds()) {
            return { success: false, error: 'token 已过期' };
        }

        try {
            this.user  = JSON.parse(userStr);
            this.token = token;
            return { success: true, user: this.user };
        } catch {
            return { success: false, error: '用户信息解析失败' };
        }
    }

    /** 小游戏（微信/抖音）：从平台 Storage 恢复 */
    private restoreMiniGame(platform: Platform.Wechat | Platform.Douyin): LoginResult {
        const api = this.getStorageAPI();
        if (!api) return { success: false, error: '平台环境异常' };

        try {
            const token   = api.getStorageSync(AuthManager.MINIGAME_TOKEN_KEY);
            const userStr = api.getStorageSync(AuthManager.MINIGAME_USER_KEY);

            if (!token || !userStr) {
                return { success: false, error: '需要登录' };
            }

            const payload = decodeJWT(token);
            if (!payload || payload.exp <= nowSeconds()) {
                return { success: false, error: '需要登录' };
            }

            this.token = token;
            this.user  = JSON.parse(userStr);
            return { success: true, user: this.user };
        } catch {
            return { success: false, error: '本地数据异常' };
        }
    }

    /** 微信：wx.login() → code → 后端换 token */
    private async doWechatLogin(): Promise<LoginResult> {
        const g: any = globalThis;
        if (!g.wx) return { success: false, error: '微信环境异常' };

        const code = await new Promise<string | null>((resolve) => {
            g.wx.login({
                success: (res: { code: string }) => resolve(res.code),
                fail: () => resolve(null),
            });
        });

        if (!code) return { success: false, error: 'wx.login 失败' };

        return this.exchangeToken('wechat', code, g.wx);
    }

    /** 抖音：tt.login() → code → 后端换 token */
    private async doDouyinLogin(): Promise<LoginResult> {
        const g: any = globalThis;
        if (!g.tt) return { success: false, error: '抖音环境异常' };

        const code = await new Promise<string | null>((resolve) => {
            g.tt.login({
                success: (res: { code: string }) => resolve(res.code),
                fail: () => resolve(null),
            });
        });

        if (!code) return { success: false, error: 'tt.login 失败' };

        return this.exchangeToken('douyin', code, g.tt);
    }

    /** 通用：code → 后端换 token → 本地存储 */
    private async exchangeToken(
        platform: string,
        code: string,
        api: any,
    ): Promise<LoginResult> {
        try {
            const data = await new Promise<{ token: string; user: UserInfo } | null>((resolve) => {
                api.request({
                    url: `${this.apiBase}/auth/login`,
                    method: 'POST',
                    header: { 'Content-Type': 'application/json' },
                    data: { platform, code },
                    success: (res: { data: { token: string; user: UserInfo } }) => resolve(res.data),
                    fail: () => resolve(null),
                });
            });

            if (!data || !data.token || !data.user) {
                return { success: false, error: '后端登录响应异常' };
            }

            this.token = data.token;
            this.user  = data.user;
            api.setStorageSync(AuthManager.MINIGAME_TOKEN_KEY, data.token);
            api.setStorageSync(AuthManager.MINIGAME_USER_KEY, JSON.stringify(data.user));

            return { success: true, user: data.user };
        } catch {
            return { success: false, error: '网络请求失败' };
        }
    }
}

// ======================== 工具函数 ========================

function nowSeconds(): number {
    return Math.floor(Date.now() / 1000);
}

function decodeJWT(token: string): JwtPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const json = atob(base64);
        return JSON.parse(json) as JwtPayload;
    } catch {
        return null;
    }
}
