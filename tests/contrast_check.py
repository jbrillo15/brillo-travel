#!/usr/bin/env python3
"""WCAG contrast check for every color pair Brillo Travel uses (HANDOFF §9).

Reads hex tokens from css/app.css, checks each pair below against its minimum,
and checks that the meaning colors stay visually distinct from each other.
Prints a Markdown table for docs/DESIGN.md. Exits 1 if anything fails.

    python3 tests/contrast_check.py
"""
import itertools
import math
import pathlib
import re
import sys

CSS = pathlib.Path(__file__).resolve().parent.parent / "css" / "app.css"

# (foreground, background, minimum ratio, where it's used)
# 4.5 = body text, 3.0 = large text (>= 24px, or >= 18.7px bold) and UI marks.
PAIRS = [
    ("text", "bg", 4.5, "Body text on the shell"),
    ("text", "surface-1", 4.5, "Body text on cards"),
    ("text", "surface-2", 4.5, "Banner and sheet text"),
    ("text", "surface-3", 4.5, "Text on a pressed button"),
    ("text-2", "bg", 4.5, "Secondary text on the shell"),
    ("text-2", "surface-1", 4.5, "Secondary text on cards"),
    ("text-2", "surface-2", 4.5, "Chips, banner detail"),
    ("text-3", "bg", 4.5, "Eyebrows, inactive tabs"),
    ("text-3", "surface-1", 4.5, "Eyebrows on cards"),
    ("osaka", "bg", 4.5, "Osaka city name and marks on the shell"),
    ("kyoto", "bg", 4.5, "Kyoto city name and marks on the shell"),
    ("tokyo", "bg", 4.5, "Tokyo city name and marks on the shell"),
    ("travel", "bg", 4.5, "Travel city name and marks on the shell"),
    ("osaka", "surface-1", 4.5, "Osaka label on a card"),
    ("kyoto", "surface-1", 4.5, "Kyoto label on a card"),
    ("tokyo", "surface-1", 4.5, "Tokyo label on a card"),
    ("travel", "surface-1", 4.5, "Travel label on a card"),
    ("now", "surface-1", 4.5, "NEXT tag text"),
    ("on-fill", "now", 4.5, "NOW tag text"),
    ("ok", "surface-1", 4.5, "On track label"),
    ("close", "surface-1", 4.5, "Getting close, Overdue, Caution"),
    ("close", "bg", 4.5, "Caution badge on the shell"),
    ("over", "surface-1", 4.5, "Over budget label"),
    ("on-fill", "allergy", 4.5, "Allergy High badge and card band"),
    ("on-fill", "text", 4.5, "Primary button label"),
    ("on-fill", "text-2", 4.5, "STAGING ribbon (light stripe)"),
    ("on-fill", "text-3", 4.5, "STAGING ribbon (dark stripe)"),
    ("paper-ink", "paper", 4.5, "Staff card text"),
    ("paper-ink-2", "paper", 4.5, "Staff card secondary text"),
    ("paper-allergy", "paper", 4.5, "Allergen word on the allergy card"),
    # UI marks (3:1)
    ("allergy", "bg", 3.0, "Allergy High badge shape on the shell"),
    ("allergy", "surface-1", 3.0, "Allergy High badge shape on a card"),
    ("ok", "surface-3", 3.0, "Meter fill on its track"),
    ("close", "surface-3", 3.0, "Meter fill on its track"),
    ("over", "surface-3", 3.0, "Meter fill on its track"),
    ("text-3", "surface-1", 3.0, "Empty checkbox ring"),
    ("on-fill", "ok", 3.0, "Checkmark on a done item"),
    ("text-2", "surface-3", 4.5, "Quiet button label while pressed"),
    ("on-fill", "text-2", 4.5, "Primary button label while pressed"),
    ("now", "bg", 3.0, "Current station on the rail"),
    ("ok", "bg", 3.0, "Done station / tick on the shell"),
    ("mix:over:70:surface-3", "surface-3", 3.0, "Over-budget meter, dark stripe"),
    ("osaka", "surface-2", 3.0, "Osaka pictogram in its tile"),
    ("kyoto", "surface-2", 3.0, "Kyoto pictogram in its tile"),
    ("tokyo", "surface-2", 3.0, "Tokyo pictogram in its tile"),
    ("travel", "surface-2", 3.0, "Travel pictogram in its tile"),
    ("text", "surface-2", 3.0, "Neutral pictogram in its tile"),
]

# v0.5 Metro: flat panels. The only tints behind text are the city top light
# (--glow-peak, 14%, behind the header) and tonight's hotel corner light (9%,
# bottom-right, away from the text-3 eyebrow). Derived surfaces are computed first.
DERIVED = {
    "neutral-top": "mix:text:5:bg",               # top light with no city
}
GLOW_PEAK = int(re.search(r"--glow-peak:\s*(\d+)%", CSS.read_text(encoding="utf-8")).group(1))
CITIES = ["osaka", "kyoto", "tokyo", "travel"]
for c in CITIES:
    DERIVED[f"{c}-top"] = f"mix:{c}:{GLOW_PEAK}:bg"  # header top light (--glow-peak, read from app.css)
    DERIVED[f"{c}-hotel"] = f"mix:{c}:9:surface-1"   # tonight's hotel corner light
    PAIRS += [
        ("text", f"{c}-top", 4.5, f"Greeting / title under the {c} top light"),
        ("text-2", f"{c}-top", 4.5, f"Day line and back link under the {c} top light"),
        ("text-3", f"{c}-top", 4.5, f"Eyebrows under the {c} top light"),
        ("text", f"{c}-hotel", 4.5, f"Hotel name on the {c} hotel light"),
        ("text-2", f"{c}-hotel", 4.5, f"Hotel details on the {c} hotel light"),
        ("on-fill", c, 3.0, f"Pictogram on the {c} tile"),
        (c, "mark", 3.0, f"{c} ring on the white station disc"),
    ]
PAIRS += [
    ("text", "neutral-top", 4.5, "Title under the neutral top light"),
    ("text-2", "neutral-top", 4.5, "Secondary text under the neutral top light"),
    ("on-fill", "mark", 4.5, "Letter and day number on the station disc"),
    ("text-3", "neutral-top", 4.5, "Eyebrows under the neutral top light"),
    ("text", "mix:text:9:surface-1", 4.5, "Hotel name on the neutral hotel light"),
    ("text-2", "mix:text:9:surface-1", 4.5, "Hotel details on the neutral hotel light"),
    ("ring-neutral", "bg", 3.0, "Neutral station ring (no city) on the shell"),
    ("ring-neutral", "mark", 3.0, "Neutral station ring on the white disc"),
    ("on-fill", "ring-neutral", 3.0, "Pictogram on the neutral tile (a city with no line color)"),
    ("text", "mix:ring-neutral:14:bg", 4.5, "Title under the neutral-city top light"),
    ("text-2", "mix:ring-neutral:14:bg", 4.5, "Day line under the neutral-city top light"),
    ("text-3", "mix:ring-neutral:14:bg", 4.5, "Eyebrows under the neutral-city top light"),
    ("text-2", "surface-3", 3.0, "Pictogram on a done (neutral) tile"),
    ("text-3", "surface-1", 3.0, "Today's day-row outline"),
]

# Colors that each carry one meaning must not be confused for each other.
MEANING = ["osaka", "kyoto", "tokyo", "travel", "now", "ok", "close", "over", "allergy"]
MIN_DELTA_E = 20  # CIE76; ~2.3 is "just noticeable", 20+ reads as a different color


def load_tokens():
    css = CSS.read_text(encoding="utf-8")
    root = css[css.index(":root"):]
    root = root[: root.index("}")]
    return {k: v.upper() for k, v in re.findall(r"--([\w-]+):\s*(#[0-9A-Fa-f]{6})", root)}


def _rgb(h):
    return [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]


def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(h):
    r, g, b = map(_lin, _rgb(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a, b):
    hi, lo = sorted((luminance(a), luminance(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def lab(h):
    r, g, b = map(_lin, _rgb(h))
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    return 116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))


def mix(t, spec):
    """'mix:a:pct:b' = CSS color-mix(in srgb, var(--a) pct%, var(--b))."""
    _, a, pct, b = spec.split(":")
    w = int(pct) / 100
    ca, cb = _rgb(t[a]), _rgb(t[b])
    return "#" + "".join("%02X" % round((w * x + (1 - w) * y) * 255) for x, y in zip(ca, cb))


def main():
    t = load_tokens()
    for name, spec in DERIVED.items():
        t[name] = mix(t, spec)
    for fg, bg, _, _ in PAIRS:
        for name in (fg, bg):
            if name.startswith("mix:") and name not in t:
                t[name] = mix(t, name)
    failed = 0
    print("| Foreground | Background | Ratio | Needs | Result | Used for |")
    print("|---|---|---|---|---|---|")
    for fg, bg, need, use in PAIRS:
        r = ratio(t[fg], t[bg])
        ok = r >= need
        failed += not ok
        print(f"| `{fg}` {t[fg]} | `{bg}` {t[bg]} | {r:.2f} | {need} | {'pass' if ok else '**FAIL**'} | {use} |")

    print("\nClosest meaning-color pairs (CIE76 ΔE, minimum %d):\n" % MIN_DELTA_E)
    dists = sorted(
        (math.dist(lab(t[a]), lab(t[b])), a, b) for a, b in itertools.combinations(MEANING, 2)
    )
    for d, a, b in dists[:5]:
        ok = d >= MIN_DELTA_E
        failed += not ok
        print(f"- `{a}` vs `{b}`: {d:.1f} {'' if ok else '**FAIL**'}")

    print(f"\n{len(PAIRS)} pairs checked, {failed} failed.", file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
