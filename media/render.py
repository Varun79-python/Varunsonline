"""
render.py -- MoviePy Post-Processing for Voltage Divider YouTube Short
Pipeline:
  1. Imports rendered scene.py video (auto-detects path)
  2. Generates TTS narration (gTTS, Indian accent co.in)
  3. Adds word-by-word dynamic subtitles (context + highlight)
  4. Adds background music (low ambient drone, −20 dB)
  5. Adds small watermark (bottom-right, Times New Roman 12pt)
  6. Exports 1080x1920 30 fps H.264 AAC

Usage:
    python render.py          # auto-renders scene.py first
    python render.py --skip   # skip re-render, use existing video
"""

from __future__ import annotations

import os
import subprocess
import sys
from typing import List, Tuple

import numpy as np
from gtts import gTTS
from moviepy import *
from moviepy.video.fx import MultiplySpeed

# ── Configuration ───────────────────────────────────────────────────────────
TOPIC: str = "Voltage Divider Circuit"
SCRIPT_TEXT: str = (
    "A voltage divider uses two resistors in series to get lower voltage. "
    "Vout equals Vin times R2 divided by R1 plus R2."
)

OUTPUT_FILE: str = "voltage_divider_short.mp4"
FPS: int = 30
RES: Tuple[int, int] = (1080, 1920)          # 9:16 portrait
BG_MUSIC_VOL: float = 0.10                    # ≈ −20 dB

# Font styling (Times New Roman throughout — use full path for PIL)
FONT_PATH: str = "C:/Windows/Fonts/times.ttf"   # Windows
SUBTITLE_SIZE: int = 36
WORD_HIGHLIGHT_SIZE: int = 60
WATERMARK_SIZE: int = 12


# ═══════════════════════════════════════════════════════════════════════════
#  STEP 1 -- Render / find Manim scene
# ═══════════════════════════════════════════════════════════════════════════
def render_manim_scene() -> str:
    """Run `manim -qh scene.py TopicScene` and return path to output MP4."""
    print("[1/5] Rendering Manim scene ...")
    result = subprocess.run(
        ["manim", "-qh", "scene.py", "TopicScene", "--disable_caching"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print("STDERR:", result.stderr)
        print("STDOUT:", result.stdout)
        raise RuntimeError("Manim render failed. See error above.")

    # Manim outputs to media/videos/scene/<resolution>p<fps>/TopicScene.mp4
    search_dirs = [
        "media/videos/scene/1920p60",
        "media/videos/scene/1080p60",
        "media/videos/scene/1080p30",
        "media/videos/scene/1080p",
    ]
    for d in search_dirs:
        path = os.path.join(d, "TopicScene.mp4")
        if os.path.isfile(path):
            print(f"  -> Found video at {path}")
            return path

    # Fallback: recursive search
    for root, _dirs, files in os.walk("media"):
        for fn in files:
            if fn.endswith(".mp4") and "TopicScene" in fn:
                full = os.path.join(root, fn)
                print(f"  -> Found video at {full}")
                return full

    raise FileNotFoundError(
        "Could not locate Manim output. Check media/videos/ subdirectories."
    )


# ═══════════════════════════════════════════════════════════════════════════
#  STEP 2 -- Text-to-Speech via gTTS  (Indian accent)
# ═══════════════════════════════════════════════════════════════════════════
def generate_tts(text: str, lang: str = "en", tld: str = "co.in") -> str:
    """Generate narration MP3 via gTTS.  Returns path to audio file."""
    print("[2/5] Generating TTS (Indian accent, tld=co.in) ...")
    path: str = "narration.mp3"
    tts = gTTS(text=text, lang=lang, tld=tld, slow=False)
    tts.save(path)
    print(f"  -> Saved TTS to {path}")
    return path


# ═══════════════════════════════════════════════════════════════════════════
#  STEP 3 -- Word-by-word subtitles  (context line + highlight word)
# ═══════════════════════════════════════════════════════════════════════════
def build_subtitle_clips(
    words: List[str],
    total_duration: float,
    video_size: Tuple[int, int],
) -> List[VideoClip]:
    """
    Two-layer subtitles:

      • Full sentence (grey, small)  -> always visible, provides context
      • Current word  (green, large) -> appears during its time-slot

    Returns a flat list of VideoClips ready for compositing.
    """
    n: int = len(words)
    word_duration: float = total_duration / n

    clips: List[VideoClip] = []

    # ── bottom layer: full sentence (context) ──────────────────────────
    full_text: str = " ".join(words)
    context_clip = TextClip(
        text=full_text,
        font=FONT_PATH,
        font_size=SUBTITLE_SIZE,
        color="#AAAAAA",
        stroke_color="black",
        stroke_width=2,
        text_align="center",
        method="label",
        size=(video_size[0] - 100, None),  # constrain width, auto height
    )
    context_y: float = video_size[1] - 160 - context_clip.h
    context_clip = context_clip.with_position(("center", context_y))
    context_clip = context_clip.with_duration(total_duration)
    clips.append(context_clip)

    # ── top layer: current word highlight ──────────────────────────────
    for i, word in enumerate(words):
        word_clip = TextClip(
            text=word,
            font=FONT_PATH,
            font_size=WORD_HIGHLIGHT_SIZE,
            color="#00FF88",
            stroke_color="black",
            stroke_width=3,
            text_align="center",
            method="label",
        )
        # Position above the context line
        word_y: float = context_y - word_clip.h - 12
        word_clip = word_clip.with_position(("center", word_y))

        start: float = i * word_duration
        word_clip = word_clip.with_start(start).with_duration(word_duration)
        clips.append(word_clip)

    return clips


# ═══════════════════════════════════════════════════════════════════════════
#  STEP 4 -- Background ambient music  (self-generated)
# ═══════════════════════════════════════════════════════════════════════════
def make_ambient_background(
    duration: float,
    sample_rate: int = 44100,
) -> AudioClip:
    """Generate a gentle ambient drone (sine-tone pad) at −20 dB."""
    n_samples: int = int(sample_rate * duration)
    t = np.linspace(0, duration, n_samples, endpoint=False)

    # Soft chord: A2 + A3 + E4 + E3
    signal: np.ndarray = (
        0.06 * np.sin(2.0 * np.pi * 110.0 * t)       # A2
        + 0.04 * np.sin(2.0 * np.pi * 220.0 * t)     # A3
        + 0.03 * np.sin(2.0 * np.pi * 329.63 * t)    # E4
        + 0.03 * np.sin(2.0 * np.pi * 164.81 * t)    # E3
    )

    # Fade in / out (0.5 s)
    fade_len: int = int(sample_rate * 0.5)
    signal[:fade_len] *= np.linspace(0, 1, fade_len)
    signal[-fade_len:] *= np.linspace(1, 0, fade_len)

    # Normalise to safe level
    peak = np.max(np.abs(signal))
    if peak > 0:
        signal = signal / peak * 0.25

    # Build stereo AudioClip
    # MoviePy may pass a scalar or a 1-D array of timestamps
    def make_frame(t):
        if isinstance(t, np.ndarray):
            idx = np.clip((t * sample_rate).astype(int), 0, n_samples - 1)
            return np.column_stack([signal[idx], signal[idx]])
        else:
            idx = min(int(t * sample_rate), n_samples - 1)
            return np.array([signal[idx], signal[idx]])

    audio = AudioClip(make_frame, duration=duration, fps=sample_rate)
    return audio.with_volume_scaled(BG_MUSIC_VOL)


# ═══════════════════════════════════════════════════════════════════════════
#  STEP 5 -- Watermark
# ═══════════════════════════════════════════════════════════════════════════
def make_watermark(video_size: Tuple[int, int]) -> TextClip:
    """Small 'OpenWork' text at bottom-right corner."""
    wm = TextClip(
        text="OpenWork",
        font=FONT_PATH,
        font_size=WATERMARK_SIZE,
        color="#777777",
        text_align="right",
        method="label",
    )
    margin: int = 12
    x: float = video_size[0] - wm.w - margin
    y: float = video_size[1] - wm.h - margin
    wm = wm.with_position((x, y))
    return wm


# ═══════════════════════════════════════════════════════════════════════════
#  MAIN PIPELINE
# ═══════════════════════════════════════════════════════════════════════════
def main(skip_manim: bool = False) -> None:
    # ── 1. Get base video ──────────────────────────────────────────────
    if skip_manim:
        # Try to find an already-rendered video
        print("[1/5] Skipping re-render, searching for existing video ...")
        try:
            video_path = render_manim_scene()
        except FileNotFoundError:
            print("  [X] No existing video found. Run without --skip first.")
            sys.exit(1)
    else:
        video_path = render_manim_scene()

    print("[3/5] Loading video & TTS ...")
    video: VideoFileClip = VideoFileClip(video_path)

    # ── 2. Generate TTS ────────────────────────────────────────────────
    tts_path: str = generate_tts(SCRIPT_TEXT)
    narration: AudioClip = AudioFileClip(tts_path)
    audio_duration: float = narration.duration
    video_duration: float = video.duration
    print(f"  -> Video duration: {video_duration:.2f}s")
    print(f"  -> Narration duration: {audio_duration:.2f}s")

    # ── Sync video speed to match audio ────────────────────────────────
    if abs(video_duration - audio_duration) > 0.5:
        speed_factor: float = video_duration / audio_duration
        print(f"  -> Speed adjustment factor: {speed_factor:.3f}x")
        video = video.with_effects([MultiplySpeed(factor=speed_factor)])
        # Cut to exact audio duration
        video = video.with_duration(audio_duration)

    # Attach narration as the primary audio
    video = video.with_audio(narration)

    # ── 3. Build subtitles ─────────────────────────────────────────────
    print("[4/5] Creating dynamic subtitles ...")
    words: List[str] = SCRIPT_TEXT.split()
    sub_clips: List[VideoClip] = build_subtitle_clips(
        words, audio_duration, RES,
    )

    # Composite video + subtitle clips
    all_layers: list = [video] + sub_clips
    final: CompositeVideoClip = CompositeVideoClip(
        all_layers, size=RES,
    ).with_duration(audio_duration)

    # ── 4. Add background music ────────────────────────────────────────
    print("[5/5] Adding background music & watermark ...")
    bg_music: AudioClip = make_ambient_background(audio_duration)
    mixed_audio: CompositeAudioClip = CompositeAudioClip([
        final.audio,
        bg_music,
    ])
    final = final.with_audio(mixed_audio)

    # ── 5. Watermark ───────────────────────────────────────────────────
    watermark: TextClip = make_watermark(RES)
    watermark = watermark.with_duration(audio_duration)
    final = CompositeVideoClip([final, watermark], size=RES).with_duration(
        audio_duration
    )

    # ── Export ─────────────────────────────────────────────────────────
    print(f"  -> Exporting {OUTPUT_FILE} ...")
    final.write_videofile(
        OUTPUT_FILE,
        fps=FPS,
        codec="libx264",
        audio_codec="aac",
        bitrate="8000k",
        preset="medium",
        threads=4,
    )

    print(f"\n[OK] Done! File saved as: {OUTPUT_FILE}")

    # Cleanup
    if os.path.isfile(tts_path):
        os.remove(tts_path)
        print("  (cleaned up temporary TTS file)")


if __name__ == "__main__":
    skip = "--skip" in sys.argv
    main(skip_manim=skip)
