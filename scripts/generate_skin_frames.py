"""Render the shop's transparent, nine-slice-safe skin borders (requires Pillow)."""

from pathlib import Path
from PIL import Image, ImageDraw


SIZE = (640, 800)
SCALE = 3
OUTPUT = Path(__file__).resolve().parents[1] / "public/shop/frames/skins"

THEMES = {
    "clasico": ("#667986", "#ffd33d", "construction"),
    "playero": ("#13baca", "#b7fff0", "waves"),
    "urbano": ("#7546df", "#20d7f3", "neon"),
    "jazzy-dancer": ("#9c55d8", "#f7c755", "stage"),
    "luchador": ("#d74748", "#f3bc50", "lucha"),
    "empresario": ("#353943", "#d5ab5d", "executive"),
    "hacker": ("#1eb9d0", "#66e4bb", "circuits"),
    "hechicero": ("#8b60da", "#d2b8ff", "runes"),
    "fenix": ("#e7603c", "#ffbb57", "flames"),
    "absoluto": ("#3474c2", "#e9c268", "royal"),
    "zombie": ("#769d48", "#ad79c8", "slime"),
    "esqueleto": ("#66738a", "#c9c3dd", "bones"),
}


def render(name, primary, accent, motif):
    width, height = SIZE
    image = Image.new("RGBA", (width * SCALE, height * SCALE))
    draw = ImageDraw.Draw(image)

    def point(xy):
        return tuple(round(value * SCALE) for value in xy)

    def line(points, color, thickness=2):
        draw.line([point(p) for p in points], fill=color, width=round(thickness * SCALE), joint="curve")

    def circle(x, y, radius, color, outline=None, thickness=1):
        draw.ellipse(point((x - radius, y - radius, x + radius, y + radius)),
                     fill=color, outline=outline, width=round(thickness * SCALE))

    def arc(box, start, end, color, thickness=2):
        draw.arc(point(box), start, end, fill=color, width=round(thickness * SCALE))

    # The continuous rail is 4 px at a 320 px card. No opaque pixel crosses
    # the 48 px nine-slice inset, so text and controls remain untouched.
    draw.rounded_rectangle(point((8, 8, width - 9, height - 9)), radius=23 * SCALE,
                           outline=primary, width=round(8 * SCALE))
    draw.rounded_rectangle(point((18, 18, width - 19, height - 19)), radius=15 * SCALE,
                           outline=accent, width=round(2 * SCALE))

    # Small corner identities fit entirely within the protected 48 px slices.
    for mirror_x in (False, True):
        for mirror_y in (False, True):
            def p(x, y):
                return (width - x if mirror_x else x,
                        height - y if mirror_y else y)

            def stroke(points, color=accent, thickness=2):
                line([p(x, y) for x, y in points], color, thickness)

            def dot(x, y, radius=2, color=accent):
                px, py = p(x, y)
                circle(px, py, radius, color)

            if motif == "construction":
                for offset in (0, 10, 20):
                    stroke([(24 + offset, 10), (31 + offset, 17)], accent, 3)
                dot(18, 18, 2.5, "#d4dce0")
            elif motif == "waves":
                x, y = p(18, 19)
                arc((x - 9, y - 5, x + 9, y + 9), 195, 340, accent, 3)
                dot(33, 28, 2, "#e3fff8")
            elif motif == "neon":
                stroke([(22, 36), (22, 24), (34, 24)], accent, 3)
                dot(39, 24, 2, "#d6a4ff")
            elif motif == "stage":
                dot(25, 25, 3, accent)
                stroke([(25, 30), (20, 38)], accent, 2)
                dot(38, 18, 1.5, "#fff3cb")
            elif motif == "lucha":
                stroke([(18, 35), (27, 26), (36, 35)], accent, 3)
                dot(27, 26, 2.5, "#fff0ba")
            elif motif == "executive":
                stroke([(21, 36), (21, 21), (36, 21)], accent, 2)
                dot(22, 22, 2, "#f3dfb0")
            elif motif == "circuits":
                stroke([(21, 39), (21, 29), (32, 29), (32, 20)], accent, 2)
                dot(32, 20, 3, accent)
            elif motif == "runes":
                stroke([(28, 20), (36, 28), (28, 36), (20, 28), (28, 20)], accent, 2)
                dot(28, 28, 2, "#f0e5ff")
            elif motif == "flames":
                stroke([(22, 37), (25, 30), (29, 33), (30, 20), (37, 29)], accent, 2.5)
                dot(37, 29, 1.5, "#ffe3a4")
            elif motif == "royal":
                stroke([(19, 33), (21, 22), (27, 28), (33, 20), (39, 33)], accent, 2)
                dot(33, 20, 2, "#fff4c7")
            elif motif == "slime":
                stroke([(21, 15), (21, 30), (25, 34)], accent, 3)
                dot(25, 36, 2.5, accent)
            elif motif == "bones":
                stroke([(19, 34), (35, 18)], accent, 2.5)
                dot(18, 35, 2.5, accent)
                dot(36, 17, 2.5, accent)

    OUTPUT.mkdir(parents=True, exist_ok=True)
    image.resize(SIZE, Image.Resampling.LANCZOS).save(OUTPUT / f"{name}-frame.png", optimize=True)


if __name__ == "__main__":
    for skin, colors in THEMES.items():
        render(skin, *colors)
