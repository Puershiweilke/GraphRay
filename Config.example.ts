/**
 * Config.example.ts — GraphRay 本地开发配置模板（提交到仓库）
 *
 * 用法：复制本文件为 assets/scripts/core/Config.ts，并填入你的本地私密信息。
 *       assets/scripts/core/Config.ts 已被 .gitignore 忽略，不会上传。
 *
 * 字段说明：
 *   GH_TOKEN      GitHub Personal Access Token（本地工具链 / CI 用）
 *   API_BASE      后端 API 基础地址（留空 = 离线模式）
 *   TIMEOUT_MS    请求超时毫秒数
 *   DEBUG         全局调试模式（数字键预设 / 调试日志）
 *   BOOT_PRESET   启动进度预设（0 = 正常存档）
 */

export const Config = {

    // ==================== 本地私密（复制为 Config.ts 后本地填入，勿提交真实值） ====================
    GH_TOKEN: '',

    // ==================== 后端 ====================
    API_BASE: '',
    TIMEOUT_MS: 5000,

    // ==================== 调试 ====================
    DEBUG: true,
    BOOT_PRESET: 0,
};
