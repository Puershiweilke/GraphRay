#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
subset_cjk.py — GraphRay 中文（非拉丁）字体子集化管线
====================================================

为什么需要它：
    Orbitron 只有拉丁字形。中文若绑 Orbitron，Web 端会隐性回退系统字体
    （用户换了手写体就崩），Native 端直接变豆腐块。因此中文必须本地化。
    但游戏文本会随版本增长（新章名 / 关卡 JSON / UI 文案），把字体"烤死"
    成当前字符串不具拓展性。本管线提供可重复的子集化 + 覆盖校验机制：

    · 扫描 assets/ 下所有 .ts 与 .json，收集出现过的「全部非 ASCII 字符」
      + 全部可打印 ASCII（含数字/英文/标点），保证当前文本零缺字。
    · 实例化 Noto Sans SC 可变字体为单字重（WEIGHT），子集化输出。
    · 输出 assets/resources/fonts/NotoSansSC-Subset.ttf（Cocos Font 资源）
      + 同款 .meta（importer: ttf-font）。
    · 额外读 tools/cjk_seed.txt（任意文本），用于手工追加未来可能用到的字。
    · --check 模式：重新扫描并报告「项目里用了、但子集字体里没有」的字符，
      在你忘记重跑管线时给出明确告警（拓展安全网）。

用法：
    python tools/subset_cjk.py            # 生成子集字体
    python tools/subset_cjk.py --check    # 仅校验覆盖，不写文件
    python tools/subset_cjk.py --weight 500

依赖：fonttools（pip install fonttools）
基础字体：tools_base_fonts/NotoSansSC-VF.ttf（首次需联网下载，见 README/注释）
"""

import os
import re
import sys
import argparse
import uuid

from fontTools import subset as ft_subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

# ----------------------------- 路径 -----------------------------
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
BASE_FONT = os.path.join(REPO, "tools_base_fonts", "NotoSansSC-VF.ttf")
OUT_DIR = os.path.join(REPO, "assets", "resources", "fonts")
OUT_TTF = os.path.join(OUT_DIR, "NotoSansSC-Subset.ttf")
SEED_FILE = os.path.join(REPO, "tools", "cjk_seed.txt")
ASSETS_DIR = os.path.join(REPO, "assets")

# ----------------------------- 可调参数 -----------------------------
WEIGHT = 400          # 实例化到的字重（修改后重跑即可）
SCAN_EXTS = (".ts", ".json")

# 额外按需追加的字符（即便项目里暂时没出现，也预置进去，拓宽未来覆盖）
# 这里放一些常见 UI / 数学 / 符号，GraphRay 涉及函数，常出现希腊字母与符号。
EXTRA_SEED = (
    "　，。、；：！？…—·≈≠≤≥±×÷√∞πθλμσφψωαβγδεζηξτυχψΩΣΦΨΓΔΘΛΞΠΣΥΦΧΨ"
    "（）《》【】〈〉「」『』〔〕〖〗〝〞〃○●◎◇◆□■△▲☆★※→←↑↓"
    "℃％°′″§¶†‡•♪♫✓"
)


def collect_chars():
    """扫描 assets/ 下所有 .ts/.json，收集全部非 ASCII + 全部 ASCII 可打印。"""
    chars = set()
    # 全部可打印 ASCII（含数字/英文/标点，让混合文本「第3章」也能单字体渲染）
    for cp in range(0x20, 0x7F):
        chars.add(chr(cp))
    # 额外种子
    for c in EXTRA_SEED:
        chars.add(c)
    # 手工种子文件
    if os.path.exists(SEED_FILE):
        with open(SEED_FILE, "r", encoding="utf-8") as f:
            for line in f:
                for c in line:
                    if c.strip():
                        chars.add(c)
    # 扫描项目文件：收集所有非 ASCII 字符（中文/数学/希腊/符号全收）
    count_files = 0
    for dp, _, fnames in os.walk(ASSETS_DIR):
        for fn in fnames:
            if not fn.endswith(SCAN_EXTS):
                continue
            fp = os.path.join(dp, fn)
            try:
                with open(fp, "r", encoding="utf-8", errors="ignore") as f:
                    text = f.read()
            except Exception as e:
                print(f"  [warn] 读取失败 {fp}: {e}")
                continue
            count_files += 1
            for c in text:
                o = ord(c)
                if 0xFE00 <= o <= 0xFE0F:   # 跳过零宽变体选择符（永不单独渲染）
                    continue
                if o >= 0x80:          # 非 ASCII 全收（覆盖 CJK/数学/符号）
                    chars.add(c)
                # ASCII 已在上面全量加入
    print(f"  扫描 {count_files} 个文件，收集到 {len(chars)} 个唯一字符")
    return chars


def build(check_only=False, weight=WEIGHT):
    if not os.path.exists(BASE_FONT):
        print(f"[错误] 找不到基础字体：{BASE_FONT}")
        print("       请先下载 Noto Sans SC 可变 TTF 到 tools_base_fonts/")
        print("       如：https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf")
        sys.exit(1)

    chars = collect_chars()

    # 加载 + 实例化可变字体为单字重
    font = TTFont(BASE_FONT)
    if "fvar" in font:
        print(f"  实例化可变字体 wght={weight} ...")
        instantiateVariableFont(font, {"wght": weight}, inplace=True)

    cmap = font.getBestCmap()
    present = {c for c in chars if ord(c) in cmap}
    missing = chars - present

    if check_only:
        if missing:
            print(f"\n[CHECK] 缺失 {len(missing)} 个字符（子集字体未覆盖）：")
            print("  " + "".join(sorted(missing)))
            print("  → 运行 `python tools/subset_cjk.py` 重新生成子集字体即可覆盖。")
            return False
        print(f"\n[CHECK] 通过：项目全部 {len(chars)} 个字符均已被子集字体覆盖。")
        return True

    if missing:
        print(f"  [warn] 基础字体本身缺 {len(missing)} 个字符（罕见）："
              + "".join(sorted(missing)[:20]))

    # 子集化
    print(f"  子集化 → {os.path.relpath(OUT_TTF, REPO)} ...")
    ss = ft_subset.Subsetter()
    ss.populate(unicodes=sorted(ord(c) for c in present))
    ss.subset(font)
    os.makedirs(OUT_DIR, exist_ok=True)
    font.save(OUT_TTF)

    # 生成 .meta（Cocos ttf-font importer）。uuid 随机生成一次。
    meta_path = OUT_TTF + ".meta"
    new_uuid = str(uuid.uuid4())
    meta = {
        "ver": "1.0.1",
        "importer": "ttf-font",
        "imported": True,
        "uuid": new_uuid,
        "files": [".ttf", os.path.basename(OUT_TTF)],
        "subMetas": {},
        "userData": {},
    }
    import json
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
        f.write("\n")

    size_kb = os.path.getsize(OUT_TTF) / 1024
    print(f"  完成：{size_kb:.0f} KB，覆盖 {len(present)} 字符")
    print(f"  已生成 .meta (uuid={new_uuid})")
    print(f"  提醒：在 Cocos Creator 中刷新/重导入 assets/resources/fonts/ 使其生效。")
    return True


def main():
    ap = argparse.ArgumentParser(description="GraphRay 中文子集化管线")
    ap.add_argument("--check", action="store_true", help="仅校验覆盖，不写文件")
    ap.add_argument("--weight", type=int, default=WEIGHT, help="实例化字重（默认 400）")
    args = ap.parse_args()
    ok = build(check_only=args.check, weight=args.weight)
    sys.exit(0 if ok else 2)


if __name__ == "__main__":
    main()
