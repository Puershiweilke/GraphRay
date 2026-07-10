# GraphRay 后端 API 规范

> 来源：AuthManager.ts / LevelDataManager.ts / Config.ts
> 文档版本：v0.3
> 更新日期：2026-07-07

---

## 1. 通用约定

### 1.1 基础 URL

由 `Config.ts` 配置：

```typescript
// assets/scripts/core/Config.ts
export const Config = {
    API_BASE: '',          // 例 "https://api.zzyhub.cn/v1"
    TIMEOUT_MS: 5000,      // 前端请求超时
};
```

本文档所有路径均相对于 `API_BASE`。前端 `API_BASE` 为空字符串时不发请求，纯本地模式。

### 1.2 请求格式

- Content-Type: `application/json`
- 鉴权头: `Authorization: Bearer <JWT token>`（进度接口必须）

### 1.3 响应格式

- 成功: HTTP 200，响应体为 JSON
- 鉴权失败: HTTP 401 `{ "error": "unauthorized" }`
- 参数校验失败: HTTP 400 `{ "error": "<原因>" }`

---

## 2. 认证 API

### 2.1 小游戏登录

```
POST /auth/login
```

**用途**：微信 / 抖音小游戏，用平台 `code` 换取 JWT。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `platform` | `string` | 是 | `"wechat"` 或 `"douyin"` |
| `code` | `string` | 是 | 平台 `login()` 返回的临时授权码 |

**处理逻辑**：
1. 用 `code` + `platform` 调微信/抖音开放平台 API 获取 `openid`
2. 以 `platform + openid` 为唯一标识查找或创建用户
3. 签发 JWT，有效期 ≥ 30 天

**成功响应** (HTTP 200)：

```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": 1,
    "email": "",
    "nickname": "玩家001",
    "avatar_url": null,
    "created_at": "2026-07-07T00:00:00Z"
  }
}
```

**失败响应** (HTTP 400 / 401)：

```json
{ "error": "invalid code" }
```

### 2.2 站内登录（Web / Desktop）

```
POST /auth/login-email
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `email` | `string` | 是 | |
| `password` | `string` | 是 | |

成功响应同 2.1。失败返回 `{ "error": "invalid credentials" }` (401)。

### 2.3 注册

```
POST /auth/register
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `email` | `string` | 是 | |
| `password` | `string` | 是 | |
| `nickname` | `string` | 否 | 默认 "玩家" + 随机数 |

成功后自动签发 JWT，返回同 2.1。

---

## 3. 用户模型

```typescript
interface User {
  id: number;
  email: string;
  nickname: string;
  avatar_url: string | null;
  created_at: string;  // ISO 8601
}

interface JwtPayload {
  userId: number;
  iat: number;   // 签发时间（秒级 Unix）
  exp: number;   // 过期时间（秒级 Unix）
}
```

- 签名算法：**HS256**
- 有效期建议：30 天（2592000 秒）

### 客户端存储规范

| 环境 | Token Key | User Key |
|------|-----------|----------|
| Web / Desktop | `zzyhub_token` | `zzyhub_user` |
| 微信小游戏 | `graphray_token` | `graphray_user` |
| 抖音小游戏 | `graphray_token` | `graphray_user` |

---

## 4. 关卡进度 API

### 4.1 关卡数据结构

GraphRay 共 **4 章 × 12 关 = 48 关**，`globalId` 全局唯一且连续：

| 章 | globalId 范围 | 章节 ID |
|----|-------------|---------|
| 第 1 章 | 1 – 12 | `1` |
| 第 2 章 | 13 – 24 | `2` |
| 第 3 章 | 25 – 36 | `3` |
| 第 4 章 | 37 – 48 | `4` |

进度存储格式：

```typescript
// key = 章节 ID（1–4），value = 已通关 globalId 数组（升序、无重复）
type Progress = Record<number, number[]>;
```

示例：

```json
{ "1": [1, 2, 4], "2": [13], "3": [], "4": [] }
```

> 注意：4 个章 key 必须**全部存在**，即使某个章暂无通关记录也需返回空数组 `[]`。

### 4.2 获取进度

```
GET /user/progress
Authorization: Bearer <token>
```

**响应** (HTTP 200)：

```json
{ "1": [1, 2, 4], "2": [], "3": [], "4": [] }
```

**前端行为**：
- 场景 `onLoad` 时发送，阻塞等待结果后才渲染关卡状态
- 响应中任何章节 key 缺失 → 前端自行补空数组
- 请求失败 → 静默降级，读客户端本地存储
- 超时（5 秒）→ 同降级
- `API_BASE` 为空 → 不发请求，纯本地模式

### 4.3 保存 / 同步进度

```
PUT /user/progress
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体**：与 4.2 响应格式完全一致。

```json
{ "1": [1, 2, 4], "2": [], "3": [], "4": [] }
```

**服务端处理要求**：

1. 校验 JWT，获取 `userId`
2. 校验请求体：顶层为 `Record<string, number[]>`，key 范围 1–4，value 中每个元素为 1–48 的整数、不重复
3. **直接覆盖存储**（不是追加合并）。因为前端已在本地做了服务端与本地进度的并集合并，PUT 时传的是最全数据
4. 返回 HTTP 200，无特殊响应体要求（`{}` 即可）

**前端行为**：
- `markComplete()` 调用后，先写本地、再异步 PUT（不阻塞游戏）
- PUT 失败仅 `console.warn`，不影响本地数据

### 4.4 离线重连合并逻辑（前端实现，服务端无需特殊处理）

前端 `load()` 时执行：

```
合并后的进度 = server ∪ local（每章的 globalId 并集）
```

即服务端返回 `{ "1": [1,2], ... }`、本地有 `{ "1": [1,2,3], ... }`（离线多打了 Lv.3），合并后为 `{ "1": [1,2,3], ... }`。合并后若比服务端多，额外异步 PUT 补推一次。服务端只管接收 PUT 并覆盖存储即可。

### 4.5 兼容旧格式（前端只读，服务端无需处理）

旧版前端以 `completedCount` 保存进度，格式为 `{ "1": 7 }`（数字 = 已通关数）。当前前端 `_normalizeServerData()` 会自动识别并展开为 ID 数组。服务端只需返回 §4.2 的新格式即可。

---

## 5. 数据库设计建议

### 5.1 users 表

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | INT PK AUTO_INCREMENT | |
| `email` | VARCHAR(255) UNIQUE | 可空（小游戏用户无 email） |
| `password_hash` | VARCHAR(255) | 可空（小游戏用户无密码） |
| `nickname` | VARCHAR(100) NOT NULL | |
| `avatar_url` | TEXT | 可空 |
| `platform` | VARCHAR(20) NOT NULL | `"email"` / `"wechat"` / `"douyin"` |
| `openid` | VARCHAR(255) | 可空，与 platform 联合唯一 |
| `created_at` | DATETIME NOT NULL DEFAULT NOW() | |

### 5.2 progress 表

| 列 | 类型 | 说明 |
|----|------|------|
| `user_id` | INT PK | |
| `data` | JSON NOT NULL | `{ "1": [1,2], "2": [], ... }` |
| `updated_at` | DATETIME NOT NULL | |

> 一章 12 关，全通关最多 48 个 globalId，JSON 列足够。也可按行存储每关一条记录（`user_id + global_id`），但 JSON 更简洁且读写一次完成。

### 5.3 SQL 参考

```sql
-- 注册
INSERT INTO users (email, password_hash, nickname, platform)
VALUES (?, ?, ?, 'email');

-- 小游戏登录
SELECT * FROM users WHERE platform = ? AND openid = ?;

-- 读取进度
SELECT data FROM progress WHERE user_id = ?;

-- 写入/覆盖进度
INSERT INTO progress (user_id, data, updated_at) VALUES (?, ?, NOW())
ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW();
```

---

## 6. 错误处理与降级

前端降级策略（全部在 `LevelDataManager._loadProgress()` 和 `_fetchWithTimeout()` 中实现）：

| 场景 | 前端行为 |
|------|---------|
| 服务器不可达 | 读本地存储 |
| HTTP 非 2xx | 读本地存储 |
| 超时（5 秒） | 读本地存储 |
| `API_BASE` 为空 | 纯本地模式，不发请求 |
| PUT 失败 | `console.warn`，不重试，不影响本地 |

---

## 7. CORS / 部署注意

- 服务端需允许来自游戏域名的跨域请求（微信/抖音小游戏 + Web 站点）
- 响应头至少包含：`Access-Control-Allow-Origin: *`（或具体域名）
- 允许的 Method: `GET, POST, PUT, OPTIONS`
- 允许的 Header: `Content-Type, Authorization`

---

> 本文档基于 `AuthManager.ts`、`LevelDataManager.ts`、`Config.ts` 的实际调用逻辑整理，覆盖了离线合并、降级策略、兼容性处理，可直接作为服务端开发规格。
