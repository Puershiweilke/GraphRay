# 更换 BGM 时更新 envelope.json

当你想换一首背景音乐，按以下步骤重新生成包络数据。

---

## 前置条件

安装 Python 依赖（仅首次）：

```bash
pip install librosa numpy
```

---

## 步骤

### 1. 准备新音频文件

将新 BGM 放到项目 `temp/` 下，支持 MP3 / OGG / WAV。

建议用**原始质量**（≥ 44100Hz）的音频提取包络，比压缩版更准。提取后仍可用压缩版（96kbps OGG）作为游戏内实际播放文件。

### 2. 运行包络提取脚本

```bash
cd GraphRay
python scripts/generate_beats.py temp/新曲目.mp3 assets/resources/envelope.json
```

### 3. 将压缩版音频放入项目

```bash
ffmpeg -i temp/新曲目.mp3 -c:a libvorbis -b:a 96k -ar 22050 assets/audios/新曲目.ogg
```

### 4. Cocos Creator 中更换 AudioSource Clip

在编辑器中把 BGM 节点的 `AudioSource.clip` 换成新的 `.ogg` 文件。

---

## 原理

脚本用 `librosa.onset.onset_strength()` 提取整首曲目的「能量包络」——一个随时间变化的 0~1 连续信号，代表音乐在每个时刻的「激烈程度」：

```
包络值
  1.0 │         ▄▄
      │        █  █
  0.5 │   ▄▄  █    █▄▄
      │ ██  ██        ██▄▄
  0.0 │█──────────────────██───
      └─────────────────────────→ 时间
```

降采样到 30Hz 后输出为 `envelope.json`（约 120KB），游戏内每帧插值读取。

---

## 调节节拍感

如果效果不满意，改 `GridBackground` 属性面板中的参数即可，无需重新生成包络：

| 参数 | 效果 |
|------|------|
| `envelopeCurve` | >1 拉开强弱差距（大节拍更炸），<1 缩小差距 |
| `attackFactor` | 起音速度，0.8=节拍立即加粗 |
| `releaseFactor` | 回落速度，0.3=快速恢复细线 |
| `thickBoost` | 最大加粗量（px） |
| `majorThickMul` / `minorThickMul` | 大小格线的单独乘数 |
