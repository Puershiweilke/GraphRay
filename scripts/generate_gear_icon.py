"""
生成八角齿轮图标，背景透明，.png 格式
用法: python generate_gear_icon.py
"""
import math
from PIL import Image, ImageDraw

# ============================================================
# 参数配置
# ============================================================
OUTPUT_SIZE = 24        # 最终输出尺寸（像素）
SUPERSAMPLE = 12        # 超采样倍数
GRAY = (255, 255, 255, 255)     # 纯白色
TRANSPARENT = (0, 0, 0, 0)
TEETH = 8                      # 齿数
TOOTH_DEPTH_RATIO = 0.72       # 齿根/齿尖比，越小齿越深
HOLE_RATIO = 0.22              # 中心孔径比
OUTPUT_PATH = "G:/个人项目/未完成/AIGC实践项目/GraphRay/assets/arts/textures/icon_settings_small.png"

# ============================================================
# 绘制
# ============================================================
draw_size = OUTPUT_SIZE * SUPERSAMPLE
cx = draw_size / 2
cy = draw_size / 2
outer_r = draw_size / 2 - 1
inner_r = outer_r * TOOTH_DEPTH_RATIO
hole_r = outer_r * HOLE_RATIO

img = Image.new("RGBA", (draw_size, draw_size), TRANSPARENT)
d = ImageDraw.Draw(img)

# 齿轮本体（齿尖 + 齿根交替）
points = []
for i in range(TEETH * 2):
    angle = (i * math.pi / TEETH) - math.pi / 2
    r = outer_r if i % 2 == 0 else inner_r
    points.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))

d.polygon(points, fill=GRAY)

# 中心轴孔
d.ellipse(
    [cx - hole_r, cy - hole_r, cx + hole_r, cy + hole_r],
    fill=TRANSPARENT
)

# ============================================================
# 下采样
# ============================================================
img_final = img.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.NEAREST)
img_final.save(OUTPUT_PATH)

# ============================================================
# 校验
# ============================================================
import numpy as np
arr = np.array(img_final)
non_zero = int(np.sum(arr[:, :, 3] > 0))
total = OUTPUT_SIZE * OUTPUT_SIZE

print(f"[OK] 八角齿轮图标已保存: {OUTPUT_PATH}")
print(f"     尺寸: {OUTPUT_SIZE}×{OUTPUT_SIZE}")
print(f"     格式: PNG RGBA (透明背景)")
print(f"     齿数: {TEETH}")
print(f"     不透明像素: {non_zero}/{total} ({100*non_zero/total:.1f}%)")
