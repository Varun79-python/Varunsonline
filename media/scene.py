"""
scene.py — ManimCE Animation for Voltage Divider Circuit YouTube Short
Generates a ~25-second educational short with dark theme, circuit animation,
current flow, formula highlighting, and CTA.

Topic: Voltage Divider Circuit
Style: 9:16 portrait, dark background #0F0F0F, high contrast
"""

from manim import *
import numpy as np
from typing import Optional

# ── Portrait config for YouTube Shorts (9:16) ──────────────────────────
config.pixel_width = 1080
config.pixel_height = 1920
config.frame_height = 16.0
config.frame_width = 9.0
config.background_color = "#0F0F0F"

# ── Brand colour palette ────────────────────────────────────────────────
C_TITLE:      str = "#00FF88"   # Hook / accent green
C_WIRE:       str = "#00D9FF"   # Circuit wires / cyan
C_HIGHLIGHT:   str = "#FF6B00"   # Resistors / orange highlights
C_TEXT:        str = "#FFFFFF"   # Labels / white
C_CURRENT:     str = "#FFEE44"   # Current-flow dot / yellow
C_BG:          str = "#0F0F0F"   # Background


# ── Helper: Zigzag Resistor Symbol ─────────────────────────────────────
class ResistorSymbol(VMobject):
    """Draws a zigzag resistor between two points."""
    def __init__(
        self,
        start: np.ndarray,
        end: np.ndarray,
        color: str = C_HIGHLIGHT,
        stroke_width: float = 6.0,
        amplitude: float = 0.25,
        segments: int = 6,
        **kwargs,
    ):
        super().__init__(**kwargs)
        diff: np.ndarray = end - start
        length: float = np.linalg.norm(diff)
        if length < 0.01:
            return
        unit_dir: np.ndarray = diff / length
        unit_perp: np.ndarray = np.array([-unit_dir[1], unit_dir[0], 0.0])

        seg_len: float = length / (segments + 1)

        points: list = [start]
        for i in range(1, segments + 1):
            base: np.ndarray = start + unit_dir * (seg_len * i)
            offset_dir: float = 1.0 if i % 2 == 1 else -1.0
            points.append(base + unit_perp * amplitude * offset_dir)
        points.append(end)

        self.set_points_as_corners(points)
        self.set_stroke(color=color, width=stroke_width)


# ── Helper: Ground Symbol (3 descending horizontal bars) ──────────────
def create_ground(
    pos: np.ndarray,
    color: str = C_WIRE,
) -> VGroup:
    """Return a VGroup of 3 lines forming the GND symbol."""
    x, y, z = pos
    bars = [
        Line(np.array([x - 0.55, y, 0]), np.array([x + 0.55, y, 0]), color=color, stroke_width=5),
        Line(np.array([x - 0.35, y - 0.18, 0]), np.array([x + 0.35, y - 0.18, 0]), color=color, stroke_width=3),
        Line(np.array([x - 0.15, y - 0.36, 0]), np.array([x + 0.15, y - 0.36, 0]), color=color, stroke_width=2),
    ]
    return VGroup(*bars)


# ── Helper: Battery plates (two parallel horizontal lines) ────────────
def create_battery(
    pos_positive: np.ndarray,
    pos_negative: np.ndarray,
    color: str = C_WIRE,
) -> VGroup:
    """Return positive (thin, long) and negative (thick, short) plates."""
    px, py, _ = pos_positive
    nx, ny, _ = pos_negative
    positive = Line(
        np.array([px - 0.22, py, 0]),
        np.array([px + 0.22, py, 0]),
        color=color, stroke_width=3,
    )
    negative = Line(
        np.array([nx - 0.16, ny, 0]),
        np.array([nx + 0.16, ny, 0]),
        color=color, stroke_width=6,
    )
    return VGroup(positive, negative)


# ── Helper: Labelled pointer (text + arrow) ────────────────────────────
def make_pointer(
    label_text: str,
    target: np.ndarray,
    direction: np.ndarray = UP + RIGHT,
    font_size: float = 32,
    color: str = C_TEXT,
    arrow_color: str = C_HIGHLIGHT,
    buff: float = 0.15,
    font_family: str = "Times New Roman",
) -> VGroup:
    """Build a Text label with an Arrow pointing at *target*."""
    label = Text(
        label_text,
        font=font_family,
        font_size=font_size,
        color=color,
    )
    # Position the label in *direction* from the target
    offset_vec: np.ndarray = direction / np.linalg.norm(direction) * 1.6
    label.move_to(target + offset_vec)
    # Align arrow from label edge toward target
    arrow = Arrow(
        label.get_edge_center(-direction),
        target,
        color=arrow_color,
        stroke_width=3,
        buff=buff,
        tip_length=0.12,
    )
    return VGroup(label, arrow)


# ═══════════════════════════════════════════════════════════════════════════
#  MAIN SCENE
# ═══════════════════════════════════════════════════════════════════════════
class TopicScene(Scene):
    """Voltage Divider Circuit explainer — 25-second YouTube Short."""

    def construct(self) -> None:
        # ── Phase 1: Hook title ────────────────────────────────────────
        title = Text(
            "Voltage Divider\nCircuit",
            font="Times New Roman",
            font_size=80,
            color=C_TITLE,
            weight=BOLD,
            line_spacing=1,
        )
        title.scale(0)                         # invisible start
        # Grow-in with a slight bounce
        self.play(
            title.animate.scale(1.2),
            run_time=1.8,
            rate_func=rate_functions.ease_out_elastic,
        )
        self.wait(0.6)
        # Shrink & slide to top-left
        self.play(
            title.animate.scale(0.45).to_edge(UP, buff=0.4).shift(RIGHT * 0.3),
            run_time=1.2,
            rate_func=rate_functions.ease_in_out_cubic,
        )
        self.wait(0.4)

        # ── Phase 2: Draw circuit ──────────────────────────────────────
        # Circuit coordinates  (portrait frame: X ∈ [-4.5, 4.5], Y ∈ [-8, 8])
        BAT_X: float = -2.5        # x-position of battery
        CTR_X: float = 0.0         # centre vertical axis
        TOP_Y: float = 3.5         # top wire y
        R1_TOP: float = 3.2        # R1 start
        R1_BOT: float = 0.5        # R1 end / Vout junction
        R2_BOT: float = -2.0       # bottom of R2 / GND

        # --- battery plates ---
        bat_pos: np.ndarray = np.array([BAT_X, TOP_Y, 0.0])
        bat_neg: np.ndarray = np.array([BAT_X, R2_BOT, 0.0])
        battery = create_battery(bat_pos, bat_neg)
        # + / - labels
        plus_sign = Text("+", font="Times New Roman", font_size=28, color=C_TITLE)
        plus_sign.next_to(bat_pos, LEFT, buff=0.15)
        minus_sign = Text("−", font="Times New Roman", font_size=28, color=C_TEXT)
        minus_sign.next_to(bat_neg, LEFT, buff=0.15)

        # --- wires ---
        top_wire = Line(
            np.array([BAT_X, TOP_Y, 0.0]),
            np.array([CTR_X, TOP_Y, 0.0]),
            color=C_WIRE, stroke_width=5,
        )
        r1_top_wire = Line(
            np.array([CTR_X, TOP_Y, 0.0]),
            np.array([CTR_X, R1_TOP, 0.0]),
            color=C_WIRE, stroke_width=5,
        )
        # R1 resistor
        r1 = ResistorSymbol(
            np.array([CTR_X, R1_TOP, 0.0]),
            np.array([CTR_X, R1_BOT, 0.0]),
            color=C_HIGHLIGHT,
        )
        # Vout junction dot
        vout_dot = Dot(
            np.array([CTR_X, R1_BOT, 0.0]),
            color=C_WIRE, radius=0.08,
        )
        # Vout tap wire
        vout_tap = Line(
            np.array([CTR_X, R1_BOT, 0.0]),
            np.array([2.2, R1_BOT, 0.0]),
            color=C_WIRE, stroke_width=5,
        )
        # R2 resistor
        r2 = ResistorSymbol(
            np.array([CTR_X, R1_BOT, 0.0]),
            np.array([CTR_X, R2_BOT, 0.0]),
            color=C_HIGHLIGHT,
        )
        # Bottom wire  (R2 bottom → battery negative)
        bot_wire = Line(
            np.array([CTR_X, R2_BOT, 0.0]),
            np.array([BAT_X, R2_BOT, 0.0]),
            color=C_WIRE, stroke_width=5,
        )
        # Ground symbol
        ground = create_ground(np.array([CTR_X, R2_BOT - 0.15, 0.0]))

        # Combine circuit elements in drawing order
        circuit_elements = [
            ("Battery", battery),
            ("Top wire", top_wire),
            ("R1 wire", r1_top_wire),
            ("R1", r1),
            ("Vout dot", vout_dot),
            ("Vout tap", vout_tap),
            ("R2", r2),
            ("Bot wire", bot_wire),
            ("Ground", ground),
        ]

        # Draw each element with Create (some grouped)
        self.play(Create(battery), run_time=0.5)
        self.play(
            Create(top_wire),
            Create(r1_top_wire),
            run_time=0.6,
        )
        self.play(Create(r1), run_time=0.8)
        self.play(
            Create(vout_dot),
            Create(vout_tap),
            run_time=0.5,
        )
        self.play(Create(r2), run_time=0.8)
        self.play(
            Create(bot_wire),
            Create(ground),
            run_time=0.6,
        )
        self.play(
            Write(plus_sign),
            Write(minus_sign),
            run_time=0.3,
        )
        self.wait(0.3)

        # ── Phase 3: Labels with arrows ────────────────────────────────
        # Vin label
        vin_label = make_pointer(
            "Vᵢₙ = Input Voltage",
            target=np.array([CTR_X, TOP_Y + 0.3, 0.0]),
            direction=UP + LEFT * 0.3,
            font_size=32,
            color=C_TITLE,
        )
        # R1 label
        r1_label = make_pointer(
            "R₁",
            target=np.array([CTR_X + 0.2, (R1_TOP + R1_BOT) / 2, 0.0]),
            direction=RIGHT + UP * 0.3,
            font_size=34,
            arrow_color=C_HIGHLIGHT,
        )
        # R2 label
        r2_label = make_pointer(
            "R₂",
            target=np.array([CTR_X + 0.2, (R1_BOT + R2_BOT) / 2, 0.0]),
            direction=RIGHT + UP * 0.2,
            font_size=34,
            arrow_color=C_HIGHLIGHT,
        )
        # Vout label
        vout_label = make_pointer(
            "Vₒᵤₜ = Output Voltage",
            target=np.array([2.2, R1_BOT, 0.0]),
            direction=RIGHT + DOWN * 0.3,
            font_size=32,
            color=C_TITLE,
        )

        self.play(
            Write(vin_label),
            Write(r1_label),
            Write(r2_label),
            run_time=1.8,
        )
        self.wait(0.3)
        self.play(Write(vout_label), run_time=0.8)
        self.wait(0.5)

        # ── Phase 4: Current flow ──────────────────────────────────────
        # Build the complete circuit loop path for the dot
        current_path = VMobject(stroke_width=0)
        # The path traces: battery+ → top wire → R1 zigzag → Vout junction
        #   → R2 zigzag → bottom wire → battery- → (through battery) → battery+
        loop_pts: list = [
            np.array([BAT_X, TOP_Y, 0.0]),   # from battery +
            np.array([CTR_X, TOP_Y, 0.0]),   # top centre
            np.array([CTR_X, R1_TOP, 0.0]),  # top of R1
        ]
        # Insert R1 zigzag points
        r1_vec = np.array([CTR_X, R1_BOT, 0.0]) - np.array([CTR_X, R1_TOP, 0.0])
        r1_len = np.linalg.norm(r1_vec)
        r1_dir = r1_vec / r1_len
        r1_perp = np.array([-r1_dir[1], r1_dir[0], 0.0])
        for i in range(1, 7):
            t = i / 7.0
            base = np.array([CTR_X, R1_TOP + t * (R1_BOT - R1_TOP), 0.0])
            offset = r1_perp * (0.2 if i % 2 == 1 else -0.2)
            loop_pts.append(base + offset)
        # Vout junction  → R2
        loop_pts.append(np.array([CTR_X, R1_BOT, 0.0]))
        # Insert R2 zigzag points
        for i in range(1, 7):
            t = i / 7.0
            base = np.array([CTR_X, R1_BOT + t * (R2_BOT - R1_BOT), 0.0])
            offset = r1_perp * (0.2 if i % 2 == 1 else -0.2)
            loop_pts.append(base + offset)
        # Bottom wire → battery-
        loop_pts.append(np.array([CTR_X, R2_BOT, 0.0]))
        loop_pts.append(np.array([BAT_X, R2_BOT, 0.0]))
        # Back through battery to +
        loop_pts.append(np.array([BAT_X, TOP_Y, 0.0]))

        current_path.set_points_smoothly(loop_pts)

        # Glowing current dot
        glow = Dot(radius=0.16, color=C_CURRENT, fill_opacity=0.35)
        core = Dot(radius=0.07, color=C_CURRENT, fill_opacity=1.0)
        current_group = VGroup(glow, core)

        self.add(current_group)
        self.play(
            MoveAlongPath(glow, current_path, run_time=3.0, rate_func=rate_functions.linear),
            MoveAlongPath(core, current_path, run_time=3.0, rate_func=rate_functions.linear),
        )
        self.wait(0.5)
        self.remove(current_group)

        # ── Phase 5: Formula ───────────────────────────────────────────
        formula = MathTex(
            r"V_{\text{out}} = V_{\text{in}} \times \frac{R_2}{R_1 + R_2}",
            font_size=52,
            color=C_TEXT,
        )
        formula.shift(DOWN * 3.8)

        self.play(Write(formula), run_time=1.8)
        self.wait(0.3)
        self.play(Indicate(formula, color=C_TITLE, scale_factor=1.08), run_time=1.5)

        # ── Phase 6: Key points summary ────────────────────────────────
        key_points_list = VGroup(
            Text("• V_in = Input Voltage", font="Times New Roman", font_size=28, color=C_TITLE),
            Text("• R₁ , R₂ = Resistors", font="Times New Roman", font_size=28, color=C_HIGHLIGHT),
            Text("• V_out = Output Voltage", font="Times New Roman", font_size=28, color=C_TITLE),
        )
        key_points_list.arrange(DOWN, aligned_edge=LEFT, buff=0.25)
        key_points_list.next_to(formula, DOWN, buff=0.5)
        key_points_list.shift(LEFT * 0.5)

        self.play(
            LaggedStart(
                *[Write(kp) for kp in key_points_list],
                lag_ratio=0.3,
            ),
            run_time=1.5,
        )
        self.wait(0.5)

        # ── Phase 7: CTA — "Follow for More" ───────────────────────────
        cta = Text(
            "Follow for More",
            font="Times New Roman",
            font_size=58,
            color=C_TITLE,
            weight=BOLD,
        )
        cta.shift(DOWN * 7.0)

        # Decorative line above CTA
        cta_line = Line(
            cta.get_left() - RIGHT * 1.2,
            cta.get_right() + RIGHT * 1.2,
            color=C_HIGHLIGHT, stroke_width=3,
        )

        self.play(
            FadeIn(cta, shift=UP * 0.4),
            Create(cta_line),
            run_time=1.5,
        )
        self.wait(1.5)
