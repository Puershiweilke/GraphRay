/**
 * Config.example.ts — GraphRay 游戏运行时配置模板（提交到仓库）
 *
 * 用法：复制本文件为 assets/scripts/core/Config.ts，并填入你的本地值。
 *       assets/scripts/core/Config.ts 已被 .gitignore 忽略，不会上传。
 *
 * 字段说明：
 *   API_BASE      后端 API 基础地址（留空 = 离线模式）
 *   TIMEOUT_MS    请求超时毫秒数
 *   DEBUG         全局调试模式（数字键预设 / 调试日志）
 *   BOOT_PRESET   启动进度预设（0 = 正常存档）
 *
 * ⚠️ 本文件会被打包进游戏客户端，仅放「分发无妨」的运行配置；
 *    开发 / CI 机密（如 GitHub token）请放仓库根目录 .env，勿填此处。
 */

export const Config = {

    // ==================== 后端（游戏运行所需） ====================
    API_BASE: '',
    TIMEOUT_MS: 5000,

    // ==================== 调试 ====================
    DEBUG: true,
    BOOT_PRESET: 0,
};
