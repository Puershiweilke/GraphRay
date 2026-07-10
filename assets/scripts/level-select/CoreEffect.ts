/**
 * CoreEffect.ts — 中心地球核心（恒定锚点）
 *
 * 设计原则（用户确立 · 2026-07-09，2026-07-09 22:19 撤环）：
 *   - 地球：恒定不变。蓝行星 + 经纬网格 + 大陆 + 青色大气，缓慢自转。
 *     切换章节时地球本身绝不改变——它是"母星家园"锚点。
 *   - 无进度环：全局进度由底部 ChapterDots（章三态）与关卡节点（每关状态）承载；
 *     进度环经多轮打磨仍与"卫星轨道网络监控终端"设定不搭，已于 2026-07-09 移除。
 *   - 抗锯齿：直接由 WebGL 画布(antialias)承担，细线 + 辉光柔化即足够；
 *     不使用超采样 RenderTexture 管线（部分环境初始化报错且收益有限）。
 *   - 正中是地球；绝不叠加中心文字或扫描光束。函数勋章（GraphRay 标识）现承载于
 *     ChapterDots 的已通关圆点上，而非环上。
 *
 * 接法：Bootstrap 在 Core 节点上挂载 CoreEffect（仅地球，无外部接口调用）。
 * 进关卡转场：由 Bootstrap 用 tween 驱动 `transitionAlpha` 整体淡出（切章不参与，保持恒定）。
 */

import { _decorator, Component, Graphics, Color, Node, UITransform } from 'cc';

const { ccclass, property } = _decorator;

const ZONE_W = 1920;
const ZONE_H = 720;
const HW = ZONE_W / 2;
const HH = ZONE_H / 2;

function toLocal(zx: number, zy: number): { x: number; y: number } {
    return { x: zx - HW, y: zy - HH };
}

// 颜色
const C_OCEAN_1 = new Color(28, 90, 134);    // 受光面
const C_OCEAN_2 = new Color(14, 58, 95);     // 基础海色
const C_OCEAN_3 = new Color(7, 31, 51);      // 暗面
const C_ATMOS   = new Color(63, 208, 255);   // 青色大气
const C_GRID    = new Color(191, 230, 255);  // 经纬网
const C_LAND_FILL = new Color(130, 142, 110);  // 大陆填充（降饱和柔和土绿，真实地球观感）
// 全局光影滤镜（覆盖整个地球表面：海洋+大陆统一受光，而非单块大陆斜面）
const C_LIGHT_HI  = new Color(225, 240, 255);  // 受光暖白（朝向太阳=左上）
const C_LIGHT_LO  = new Color(2, 8, 16);       // 背光暗色（背向太阳=右下）
const C_SIGNAL  = new Color(158, 255, 0);    // 信号绿
const C_GOLD    = new Color(239, 195, 74);   // 金色极光

// 经纬网参数（加粗 + 变淡：更粗的线、更低的透明度，呈柔和辉光感）
const GRID_W         = 3.2;   // 普通经纬线宽（再加粗）
const GRID_W_EQ      = 5;   // 赤道线宽（视觉锚点，再加粗）
const GRID_A_LAT     = 5;   // 纬线透明度（更透）
const GRID_A_LONG    = 5;    // 经线透明度（更透）
const GRID_A_EQ      = 10;   // 赤道透明度（更透）
const GRID_MERIDIANS = 12;                                    // 经线数量
const GRID_LATS      = [-50, -30, -10, 10, 30, 50];           // 纬线纬度（不含赤道）
// 大陆（极简风：保留洲际位置与可辨认轮廓，几何化、平滑、简化，不追求地理精确；
//       内陆水系不再镂空，整体简化。渲染仍走点阵光栅化，无鬼畜。）
const CONTINENTS: { lon: number; lat: number }[][] = [
    // 非洲：西非 bulge → 东非之角 → 向南收窄为尖
    [ {lon:-17,lat:21}, {lon:10,lat:34}, {lon:33,lat:31}, {lon:51,lat:11},
      {lon:40,lat:-15}, {lon:20,lat:-35}, {lon:12,lat:-18}, {lon:8,lat:0}, {lon:-17,lat:14} ],
    // 欧亚（亚洲特征化、仍几何简化）：欧洲西 → 北欧 → 西伯利亚北岸三折 → 远东东北角 →
    //   东亚东岸 → 华南 → 中南半岛南凸 → 孟加拉湾 → 印度三角尖 → 印度西岸 → 阿拉伯半岛 → 小亚细亚 → 地中海东岸回欧洲
    [ {lon:-10,lat:36}, {lon:0,lat:51}, {lon:8,lat:58}, {lon:28,lat:70},
      {lon:60,lat:69}, {lon:100,lat:75}, {lon:140,lat:73}, {lon:170,lat:66},
      {lon:160,lat:55}, {lon:140,lat:45}, {lon:131,lat:43}, {lon:129,lat:39},
      {lon:129,lat:34}, {lon:126,lat:38}, {lon:122,lat:30}, {lon:118,lat:22},
      {lon:108,lat:18}, {lon:100,lat:9}, {lon:90,lat:22}, {lon:80,lat:8},
      {lon:72,lat:20}, {lon:60,lat:25}, {lon:52,lat:18}, {lon:45,lat:13},
      {lon:43,lat:20}, {lon:35,lat:31}, {lon:28,lat:36}, {lon:15,lat:38} ],
    // 北美洲：阿拉斯加 → 加拿大 → 美国东岸 → 墨西哥收窄
    [ {lon:-165,lat:65}, {lon:-95,lat:70}, {lon:-60,lat:60}, {lon:-75,lat:40},
      {lon:-80,lat:25}, {lon:-95,lat:17}, {lon:-110,lat:23}, {lon:-117,lat:32}, {lon:-125,lat:48} ],
    // 中美洲（干净狭长地峡，连接北美与南美）
    [ {lon:-95,lat:17}, {lon:-88,lat:16}, {lon:-83,lat:10}, {lon:-78,lat:8} ],
    // 南美洲：北宽南尖
    [ {lon:-78,lat:8}, {lon:-60,lat:5}, {lon:-35,lat:-8}, {lon:-48,lat:-25},
      {lon:-70,lat:-55}, {lon:-73,lat:-40}, {lon:-78,lat:-12} ],
    // 澳大利亚：圆润
    [ {lon:114,lat:-22}, {lon:135,lat:-12}, {lon:145,lat:-15}, {lon:153,lat:-28},
      {lon:148,lat:-38}, {lon:118,lat:-35} ],
    // —— 精选图标式岛屿（保持可辨认性，几何化干净形状）——
    // 格陵兰
    [ {lon:-45,lat:60}, {lon:-20,lat:70}, {lon:-30,lat:83}, {lon:-55,lat:80}, {lon:-55,lat:65} ],
    // 大不列颠
    [ {lon:-5,lat:50}, {lon:-1,lat:51}, {lon:0,lat:54}, {lon:-3,lat:58}, {lon:-6,lat:57}, {lon:-7,lat:53} ],
    // 马达加斯加
    [ {lon:43,lat:-12}, {lon:50,lat:-15}, {lon:50,lat:-25}, {lon:45,lat:-25}, {lon:43,lat:-18} ],
    // 日本（小弧）
    [ {lon:130,lat:33}, {lon:138,lat:35}, {lon:143,lat:42}, {lon:141,lat:45}, {lon:136,lat:40}, {lon:132,lat:35} ],
    // 台湾
    [ {lon:119,lat:21}, {lon:123,lat:21}, {lon:123,lat:25}, {lon:119,lat:25} ],
    // 海南岛
    [ {lon:108,lat:17}, {lon:112,lat:17}, {lon:112,lat:20}, {lon:108,lat:20} ],
    // 新西兰
    [ {lon:172,lat:-34}, {lon:178,lat:-38}, {lon:176,lat:-42}, {lon:168,lat:-46}, {lon:167,lat:-44}, {lon:171,lat:-37} ],
];

// （内陆水体镂空已移除：极简风大陆不再单独表现地中海/黑海/红海/里海/贝加尔湖/五大湖）

// 大陆点阵采样（密集填充点 + 逐点可见性测试，彻底消除地平裁切产生的"鬼畜"）
const LAND_STEP   = 2;     // 采样经度/纬度步长 (度)；2° 兼顾小岛可见性与性能
const LAND_DOT_R  = 2.4;   // 点半径 (px)，足够大以相互重叠、读作实心陆地

@ccclass('CoreEffect')
export class CoreEffect extends Component {

    @property({ tooltip: '核心 X 坐标（OrbitZone 坐标，默认 960 = 中心）' })
    coreX: number = 960;

    @property({ tooltip: '核心 Y 坐标（OrbitZone 坐标，默认 360 = 中心）' })
    coreY: number = 360;

    @property({ tooltip: '地球半径 (px)' })
    planetR: number = 44;

    @property({ tooltip: '地球自转角速度 (度/秒)，0 = 完全静止' })
    spinSpeed: number = 15;

    @property({ tooltip: '俯仰角 (度)：观察者抬头/低头看地球的视角。0=赤道正视，约23.5°呈真实地轴倾斜，90=正俯视北极。可调，运行时亦可用 setPitch() 改变' })
    tiltDeg: number = 22.5;

    private _pitch: number = 0;   // 俯仰角 (弧度)，由 tiltDeg 初始化，运行时经 setPitch 更新

    private _earthG: Graphics | null = null;   // 行星本体（填充）
    private _atmoG: Graphics | null = null;    // 大气辉光（描边）
    private _gridG: Graphics | null = null;    // 经纬网（自转）
    private _landG: Graphics | null = null;    // 大陆（自转）
    private _lightG: Graphics | null = null;   // 全局光影滤镜（覆盖海+陆，自转层内、网格之下）
    private _spinNode: Node | null = null;
    private _time: number = 0;
    private _phase: number = 0;   // 自转相位（绕地轴），替代整层 in-plane 旋转
    private _landPts: { lon: number; lat: number }[][] = [];   // 大陆点阵（预采样，消除地平裁切鬼畜）

    /** 整体淡出系数（0..255）。进关卡转场时由 Bootstrap 用 tween 驱动到 0；
     *  切章保持 255（母星恒定锚点，不参与擦除）。所有绘制 alpha 经 `_a()` 缩放。 */
    transitionAlpha: number = 255;

    onLoad(): void {
        // 复用 Core 节点上已有的 Graphics 作为行星本体层
        this._earthG = this.getComponent(Graphics) || this.addComponent(Graphics);
        // 大气辉光：独立子节点。Cocos 一个节点只能挂一个 renderable(Graphics)，
        // 故不能与 earthG 同节点（否则报 "Can't add renderable component"）。
        const atmoNode = new Node('AtmoLayer');
        atmoNode.parent = this.node;
        atmoNode.layer = this.node.layer;
        atmoNode.addComponent(UITransform).setContentSize(200, 200);
        this._atmoG = atmoNode.addComponent(Graphics);

        // 自转层（先建！确保即便环/抗锯齿管线初始化失败，地球仍能自转、不崩帧）
        this._spinNode = new Node('SpinLayer');
        this._spinNode.parent = this.node;
        this._spinNode.layer = this.node.layer;
        this._spinNode.addComponent(UITransform).setContentSize(200, 200);

        // 大陆独立子节点：规避 Cocos 3.8 同节点第二个 Graphics.fill() 不渲染的问题
        const landNode = new Node('LandLayer');
        landNode.parent = this._spinNode;
        landNode.layer = this.node.layer;
        landNode.addComponent(UITransform).setContentSize(200, 200);
        this._landG = landNode.addComponent(Graphics);

        // 全局光影滤镜层：覆盖海洋+大陆，统一受光（在大陆之上、网格之下）
        const lightNode = new Node('LightLayer');
        lightNode.parent = this._spinNode;
        lightNode.layer = this.node.layer;
        lightNode.addComponent(UITransform).setContentSize(200, 200);
        this._lightG = lightNode.addComponent(Graphics);

        // 经纬网置于最上层（更高显示优先级）：GridLayer 创建于 LightLayer 之后，渲染在更上层
        const gridNode = new Node('GridLayer');
        gridNode.parent = this._spinNode;
        gridNode.layer = this.node.layer;
        gridNode.addComponent(UITransform).setContentSize(200, 200);
        this._gridG = gridNode.addComponent(Graphics);

        this._buildLandPoints();   // 预采样大陆点阵（每个大陆内部布满密点，逐点可见性测试，根除地平裁切鬼畜）

        // 俯仰角改为真正的 3D 正交投影（绕 X 轴），不再用整层 in-plane 旋转模拟倾角
        this._pitch = this.tiltDeg * Math.PI / 180;
    }

    update(dt: number): void {
        this._time += dt;
        this._phase += this.spinSpeed * Math.PI / 180 * dt;   // 绕地轴自转（相位推进）

        this._drawEarth();
        this._drawAtmo();
        this._drawSpin();
    }

    /** 缩放某 alpha（0..255）到当前淡出系数下的最终 alpha */
    private _a(v: number): number {
        return Math.floor(v * this.transitionAlpha / 255);
    }

    // ==================== 地球（恒定） ====================

    private _drawEarth(): void {
        const g = this._earthG;
        if (!g) return;
        const { x, y } = toLocal(this.coreX, this.coreY);
        const r = this.planetR;
        g.clear();

        g.fillColor = new Color(C_OCEAN_2.r, C_OCEAN_2.g, C_OCEAN_2.b, this._a(255)); g.circle(x, y, r); g.fill();
        // 海洋基色（均匀）；整体方向性光照交由 _drawLightFilter 统一处理（覆盖海+陆）。
    }

    private _drawAtmo(): void {
        const g = this._atmoG;
        if (!g) return;
        const { x, y } = toLocal(this.coreX, this.coreY);
        const r = this.planetR;
        g.clear();

        const breath = 0.5 + Math.sin(this._time * 0.8) * 0.5; // 0–1 恒定呼吸
        g.strokeColor = new Color(C_ATMOS.r, C_ATMOS.g, C_ATMOS.b, Math.floor((0.06 + breath * 0.04) * this._a(255)));
        g.lineWidth = 8; g.circle(x, y, r + 12); g.stroke();
        g.strokeColor = new Color(C_ATMOS.r, C_ATMOS.g, C_ATMOS.b, Math.floor((0.12 + breath * 0.06) * this._a(255)));
        g.lineWidth = 4; g.circle(x, y, r + 6); g.stroke();
    }

    // ==================== 自转层（俯仰角 + 绕轴自转，真正 3D 正交投影） ====================
    //
    // 投影流程（每个地表点：经度 lon、纬度 lat）：
    //   1) 自转：绕地轴(Y)旋转相位 phase → (X, Z)（纬度 Y 不变）。
    //   2) 俯仰：绕东西轴(X)旋转 pitch → (Yp, Zp)；Zp>=0 为朝观众半球。
    //   3) 屏幕：sx = x + r·X，sy = y + r·Yp（Cocos Y-up，北恒为上）。
    // 俯仰角由 tiltDeg 属性（或 setPitch）控制：0=赤道正视，90=正俯视北极，
    // 约 23.5° 呈真实地轴倾斜观感。所有图元（经/纬/大陆）共用同一套投影，
    // 背面 (Zp<0) 不绘制，天然呈现"球体遮挡"，无需任何裁切，也无地平裁切鬼畜。

    private _drawSpin(): void {
        const g = this._gridG;
        if (!g) return;
        const { x, y } = toLocal(this.coreX, this.coreY);
        const r = this.planetR;

        // ---- 经纬网 ----
        g.clear();

        // 经线（子午线）：与大陆共用同一自转相位，连续投影；再绕 X 轴俯仰，逐点判可见性
        const ca = Math.cos(this._pitch), sa = Math.sin(this._pitch);
        for (let k = 0; k < GRID_MERIDIANS; k++) {
            const phi = (k * (Math.PI * 2 / GRID_MERIDIANS)) + this._phase;
            this._drawMeridian(g, x, y, r, phi, ca, sa);
        }

        // 纬线（平行圈）：逐点投影 + 俯仰，仅绘制朝观众半球 (Zp>=0)
        for (const latDeg of GRID_LATS) {
            const lat = latDeg * Math.PI / 180;
            const cl = Math.cos(lat);
            const Ye = Math.sin(lat);
            g.strokeColor = new Color(C_GRID.r, C_GRID.g, C_GRID.b, this._a(GRID_A_LAT));
            g.lineWidth = GRID_W;
            let drawing = false;
            const M = 48;
            for (let j = 0; j <= M; j++) {
                const lon = j * (Math.PI * 2 / M) + this._phase;
                const Xe = cl * Math.sin(lon);
                const Ze = cl * Math.cos(lon);
                const Yp = Ye * ca - Ze * sa;
                const Zp = Ye * sa + Ze * ca;
                const sx = x + r * Xe, sy = y + r * Yp;
                if (Zp >= 0) { if (!drawing) { g.moveTo(sx, sy); drawing = true; } else g.lineTo(sx, sy); }
                else drawing = false;
            }
            g.stroke();
        }

        // 赤道高亮（视觉锚点，最显眼）：赤道 lat=0
        {
            const Ye = 0;
            g.strokeColor = new Color(C_GRID.r, C_GRID.g, C_GRID.b, this._a(GRID_A_EQ));
            g.lineWidth = GRID_W_EQ;
            let drawing = false;
            const M = 48;
            for (let j = 0; j <= M; j++) {
                const lon = j * (Math.PI * 2 / M) + this._phase;
                const Xe = Math.sin(lon);
                const Ze = Math.cos(lon);
                const Yp = Ye * ca - Ze * sa;
                const Zp = Ye * sa + Ze * ca;
                const sx = x + r * Xe, sy = y + r * Yp;
                if (Zp >= 0) { if (!drawing) { g.moveTo(sx, sy); drawing = true; } else g.lineTo(sx, sy); }
                else drawing = false;
            }
            g.stroke();
        }

        // ---- 大陆：预采样点阵 + 逐点正交投影 + 逐点可见性测试（彻底消除地平裁切鬼畜）----
        this._drawLand();

        // ---- 全局光影滤镜（覆盖海+陆的统一方向性光照 + 柔光模糊）----
        this._drawLightFilter();
    }

    /** 绘制一条经线（子午线大圆）。phi 已含自转相位；再绕 X 轴俯仰 pitch，
     *  逐点判可见性 Zp>=0（背面被球体遮挡则不画），与大陆/纬线共用同一套投影。 */
    private _drawMeridian(g: Graphics, x: number, y: number, r: number, phi: number, ca: number, sa: number): void {
        const N = 32;
        g.strokeColor = new Color(C_GRID.r, C_GRID.g, C_GRID.b, this._a(GRID_A_LONG));
        g.lineWidth = GRID_W;
        let drawing = false;
        for (let i = 0; i <= N; i++) {
            const th = -Math.PI / 2 + Math.PI * i / N;   // 纬度从南极到北极
            const ct = Math.cos(th);
            const Xe = ct * Math.sin(phi);
            const Ye = Math.sin(th);
            const Ze = ct * Math.cos(phi);
            const Yp = Ye * ca - Ze * sa;
            const Zp = Ye * sa + Ze * ca;
            const sx = x + r * Xe;
            const sy = y + r * Yp;
            if (Zp >= 0) { if (!drawing) { g.moveTo(sx, sy); drawing = true; } else g.lineTo(sx, sy); }
            else drawing = false;
        }
        g.stroke();
    }

    /** 预采样大陆点阵：对每个大陆多边形按 LAND_STEP 网格采样其内部点（射线法判断内外），
     *  一次性存好。运行时只做"旋转 → 正面半球(Z>=0)可见性测试 → 画点"，不再做任何多边形裁切，
     *  因而从根上消除地平裁切产生的"鬼畜"（弹出/连带变形）。 */
    private _buildLandPoints(): void {
        this._landPts = [];
        for (const poly of CONTINENTS) {
            let minLon = 360, maxLon = -360, minLat = 90, maxLat = -90;
            for (const v of poly) {
                if (v.lon < minLon) minLon = v.lon;
                if (v.lon > maxLon) maxLon = v.lon;
                if (v.lat < minLat) minLat = v.lat;
                if (v.lat > maxLat) maxLat = v.lat;
            }
            const pts: { lon: number; lat: number }[] = [];
            for (let lo = minLon; lo <= maxLon; lo += LAND_STEP) {
                for (let la = minLat; la <= maxLat; la += LAND_STEP) {
                    if (!this._pointInPoly(lo, la, poly)) continue;
                    pts.push({ lon: lo, lat: la });
                }
            }
            this._landPts.push(pts);
        }
    }

    /** 射线法：点 (lon,lat) 是否在多边形 poly 内部 */
    private _pointInPoly(lon: number, lat: number, poly: { lon: number; lat: number }[]): boolean {
        let inside = false;
        const n = poly.length;
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = poly[i].lon, yi = poly[i].lat, xj = poly[j].lon, yj = poly[j].lat;
            if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }

    /** 绘制大陆：点阵光栅化（替代多边形裁切，根除鬼畜）。
     *  每点先绕地轴自转 phase，再绕东西轴俯仰 pitch → (Yp, Zp)；纬度经自转后不变，
     *  东西宽由 X=cos(lat)·sin(lon+phase) 自然压缩 → 越靠视缘越窄；近地平线(Zp→0)逐点淡出，无硬边。
     *  X 不翻转（东在右）、Yp 含俯仰（北恒在上）：常规地图朝向。点半径足够大、彼此重叠，读作实心陆地。 */
    private _drawLand(): void {
        const g = this._landG;
        if (!g) return;
        const { x, y } = toLocal(this.coreX, this.coreY);
        const r = this.planetR;
        g.clear();
        const ph = this._phase;
        const cph = Math.cos(ph), sph = Math.sin(ph);
        const ca = Math.cos(this._pitch), sa = Math.sin(this._pitch);
        const R = LAND_DOT_R;
        // pass 1：实心内部（Zp>=0.28）一次成型、单次填充，性能友好
        g.fillColor = new Color(C_LAND_FILL.r, C_LAND_FILL.g, C_LAND_FILL.b, this._a(255));
        for (const cont of this._landPts) {
            for (const p of cont) {
                const la = p.lat * Math.PI / 180, lo = p.lon * Math.PI / 180;
                const cl = Math.cos(la);
                const X0 = cl * Math.sin(lo), Y0 = Math.sin(la), Z0 = cl * Math.cos(lo);
                const X = X0 * cph + Z0 * sph;          // 绕地轴自转
                const Z = -X0 * sph + Z0 * cph;
                const Yp = Y0 * ca - Z * sa;            // 绕 X 轴俯仰
                const Zp = Y0 * sa + Z * ca;
                if (Zp < 0.28) continue;
                const sx = x + r * X, sy = y + r * Yp;   // X 不翻转（东在右）；Yp 含俯仰
                g.circle(sx, sy, R);
            }
        }
        g.fill();
        // pass 2：近地平线淡出通道（Zp∈[0,0.28)）逐点独立透明度
        for (const cont of this._landPts) {
            for (const p of cont) {
                const la = p.lat * Math.PI / 180, lo = p.lon * Math.PI / 180;
                const cl = Math.cos(la);
                const X0 = cl * Math.sin(lo), Y0 = Math.sin(la), Z0 = cl * Math.cos(lo);
                const X = X0 * cph + Z0 * sph;
                const Z = -X0 * sph + Z0 * cph;
                const Yp = Y0 * ca - Z * sa;
                const Zp = Y0 * sa + Z * ca;
                if (Zp < 0 || Zp >= 0.28) continue;
                const fade = Math.min(1, Zp * 3.5);
                const sx = x + r * X, sy = y + r * Yp;
                g.fillColor = new Color(C_LAND_FILL.r, C_LAND_FILL.g, C_LAND_FILL.b, this._a(Math.max(0, Math.round(255 * fade))));
                g.circle(sx, sy, R);
                g.fill();
            }
        }
    }

    /** 全局光影滤镜：覆盖整个地球表面（海洋+大陆统一），方向性光照（左上受光 / 右下暗面）+
     *  多层低透明度圆叠加形成的柔和过渡（"模糊"观感）。固定在世界空间（太阳不动）。
     *  该层置于大陆之上、经纬网之下，使网格保持清晰、表面特征共享同一套光照。 */
    private _drawLightFilter(): void {
        const g = this._lightG;
        if (!g) return;
        const { x, y } = toLocal(this.coreX, this.coreY);
        const r = this.planetR;
        g.clear();
        const N = 12;                                   // 多层叠加 → 柔光（模糊）过渡
        const hx = x - r * 0.25, hy = y + r * 0.25;     // 受光中心（左上，Y 取正）
        const sx = x + r * 0.28, sy = y - r * 0.28;     // 背光中心（右下，Y 取正）
        for (let i = 1; i <= N; i++) {
            const f = i / N;
            g.fillColor = new Color(C_LIGHT_HI.r, C_LIGHT_HI.g, C_LIGHT_HI.b, this._a(Math.round(6 * f)));
            g.circle(hx, hy, r * (0.55 + 0.45 * f)); g.fill();
            g.fillColor = new Color(C_LIGHT_LO.r, C_LIGHT_LO.g, C_LIGHT_LO.b, this._a(Math.round(8 * f)));
            g.circle(sx, sy, r * (0.60 + 0.40 * f)); g.fill();
        }
    }

    // ==================== 对外接口 ====================

    /** 运行时设置俯仰角 (度)：0=赤道正视，90=正俯视北极 */
    setPitch(deg: number): void {
        this.tiltDeg = deg;
        this._pitch = deg * Math.PI / 180;
    }
}
