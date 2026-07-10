"""
generate_beats.py v2
离线分析 BGM 的 onset 强度包络，输出 continuous envelope 供实时驱动。

策略：
- 用原始 MP3 全质量（48000Hz）保证节拍检测精度
- 输出降采样到 ~30Hz 的归一化包络值数组
- 输出连续包络 + 离散节拍双轨数据

用法：
    python scripts/generate_beats.py <音频文件> <输出json>

依赖：
    pip install librosa numpy
"""

import sys
import json
import numpy as np

try:
    import librosa
except ImportError:
    print("请先安装 librosa: pip install librosa")
    sys.exit(1)


def main(input_path: str, output_path: str):
    print(f"加载音频: {input_path}")

    # 用原始采样率保证节拍检测精度
    y, sr = librosa.load(input_path, sr=None, mono=True)
    duration = len(y) / sr
    print(f"时长: {duration:.1f}s, 采样率: {sr}Hz")

    # --- 1. onset_strength 连续包络 ---
    hop = 512
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    env_times = librosa.frames_to_time(
        np.arange(len(onset_env)), sr=sr, hop_length=hop
    )

    # 降采样到约 30Hz：计算目标采样点数
    target_hz = 30
    target_count = int(duration * target_hz)
    # 对全包络做均匀重采样
    envelope_raw = np.interp(
        np.linspace(0, len(onset_env) - 1, target_count),
        np.arange(len(onset_env)),
        onset_env,
    )
    # 归一化到 0~1
    max_env = float(np.max(envelope_raw)) or 1.0
    envelope = np.round(envelope_raw / max_env, 4).tolist()

    # --- 2. 离散节拍（回溯精确峰值） ---
    onset_frames = librosa.onset.onset_detect(
        onset_envelope=onset_env, sr=sr, hop_length=hop,
        delta=0.08,          # 更敏感
        backtrack=True,
    )
    beat_times = librosa.frames_to_time(onset_frames, sr=sr, hop_length=hop)
    frame_indices = librosa.time_to_frames(beat_times, sr=sr, hop_length=hop)
    beat_strengths = [
        round(float(onset_env[min(i, len(onset_env) - 1)]) / max_env, 3)
        for i in frame_indices
    ]
    beats = [
        {"t": round(float(t), 3), "strength": s}
        for t, s in zip(beat_times, beat_strengths)
    ]

    # --- 输出 ---
    output = {
        "duration": round(duration, 2),
        "sr": int(sr),
        "envelope_hz": target_hz,
        "envelope_count": len(envelope),
        "envelope": envelope,
        "beat_count": len(beats),
        "avg_interval": round(duration / max(len(beats), 1), 2),
        "beats": beats,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # 统计信息
    print(f"包络: {len(envelope)} 个采样点 @ {target_hz}Hz")
    print(f"节拍: {len(beats)} 个, 平均间隔 {output['avg_interval']}s")
    print(f"已写入: {output_path}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("用法: python generate_beats.py <音频文件> <输出json>")
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
