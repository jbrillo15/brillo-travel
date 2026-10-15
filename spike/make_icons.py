"""Draw the Phase 0 spike icons (PNG, no dependencies).

Placeholder only: ink-navy square with the trip as a three-station line
(Osaka pink -> Kyoto matcha -> Tokyo lavender), per DESIGN.md §9. The real
icon set is exported in Phase 1 after design approval.

    python3 spike/make_icons.py
"""
import pathlib
import struct
import zlib

BG = (0x0D, 0x13, 0x22)
LINE = (0x3B, 0x48, 0x68)
STATIONS = [((0.24, 0.68), (0xF2, 0xA7, 0xC3)),
            ((0.50, 0.50), (0xB9, 0xD7, 0x95)),
            ((0.76, 0.32), (0xB4, 0xAD, 0xF2))]
R_STATION, R_INNER, LINE_W = 0.095, 0.045, 0.035
SS = 4  # supersamples per axis


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return ((px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2) ** 0.5


def color_at(x, y):
    for (sx, sy), col in STATIONS:
        d = ((x - sx) ** 2 + (y - sy) ** 2) ** 0.5
        if d <= R_INNER:
            return BG
        if d <= R_STATION:
            return col
    (ax, ay), (bx, by), (cx, cy) = (s[0] for s in STATIONS)
    if min(seg_dist(x, y, ax, ay, bx, by), seg_dist(x, y, bx, by, cx, cy)) <= LINE_W / 2:
        return LINE
    return BG


def render(size):
    rows = []
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            acc = [0, 0, 0]
            for sy in range(SS):
                for sx in range(SS):
                    c = color_at((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size)
                    acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]
            row += bytes(v // (SS * SS) for v in acc)
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


here = pathlib.Path(__file__).parent
for size in (180, 192, 512):
    (here / f"icon-{size}.png").write_bytes(render(size))
    print(f"icon-{size}.png")
