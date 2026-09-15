#!/usr/bin/env python3
"""Demo-Besucherdaten, Heatmap-PNG und Injektion in auswertung.html."""
from __future__ import annotations

import argparse
import random
import struct
import zlib
from datetime import date, datetime, timedelta
from pathlib import Path

PALETTE = [
    (0xF8, 0x69, 0x6B),
    (0xF9, 0x7B, 0x6E),
    (0xFA, 0x8E, 0x72),
    (0xFB, 0xA0, 0x75),
    (0xFC, 0xB3, 0x79),
    (0xFD, 0xC5, 0x7C),
    (0xFE, 0xD8, 0x80),
    (0xFF, 0xEB, 0x84),
    (0xE9, 0xE5, 0x83),
    (0xD3, 0xDF, 0x82),
    (0xBD, 0xD8, 0x81),
    (0xA6, 0xD2, 0x7F),
    (0x90, 0xCB, 0x7E),
    (0x7A, 0xC5, 0x7D),
    (0x63, 0xBE, 0x7B),
]
WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
HOURS = list(range(8, 20))
HEADER = "Kategorie;Anzahl;Zeitstempel"
LABELS = {
    "hinterbliebene": "Hinterbliebene",
    "hausfuehrung": "Hausführung",
    "grabverkauf": "Grabverkauf",
}


def generate_rows(end: date | None = None) -> list[tuple[str, int, str]]:
    end = end or date(2026, 9, 12)
    start = date(2026, 6, 16)  # Dienstag; volle Wochen bis Mitte September
    rng = random.Random(20260915)
    rows: list[tuple[str, int, str]] = []
    day = start
    while day <= end:
        wd = day.weekday()
        weekend = wd >= 5
        for hour in HOURS:
            if hour in (8, 19) and rng.random() < 0.55:
                continue
            if hour in (9, 18) and rng.random() < 0.28:
                continue
            events: list[tuple[str, int]] = []
            if weekend:
                if 10 <= hour <= 16:
                    hinter = rng.choices([0, 1, 2, 3, 4], [8, 18, 14, 6, 2])[0]
                else:
                    hinter = rng.choices([0, 1, 2], [18, 10, 3])[0]
                if hinter:
                    events.append(("hinterbliebene", hinter))
                if rng.random() < 0.08:
                    events.append(("hausfuehrung", rng.choice([6, 8, 10, 12])))
                if rng.random() < 0.12:
                    events.append(("grabverkauf", rng.choice([1, 2])))
            else:
                if 10 <= hour <= 15:
                    verkauf = rng.choices([0, 1, 2, 3], [10, 16, 8, 2])[0]
                    hinter = rng.choices([0, 1, 2], [16, 10, 3])[0]
                else:
                    verkauf = rng.choices([0, 1], [18, 7])[0]
                    hinter = rng.choices([0, 1], [20, 5])[0]
                if hinter:
                    events.append(("hinterbliebene", hinter))
                if verkauf:
                    events.append(("grabverkauf", verkauf))
                if 10 <= hour <= 14 and rng.random() < 0.16:
                    events.append(("hausfuehrung", rng.choice([4, 6, 8, 10, 12])))
            for kat, n in events:
                rows.append((kat, n, f"{day.isoformat()} {hour:02d}:00"))
        day += timedelta(days=1)
    return rows


def csv_text(rows: list[tuple[str, int, str]]) -> str:
    lines = [
        "# DEMO=1; Fantasiewerte zum Spielen, Leerung am 1.1.2027 00:00 Europe/Berlin",
        HEADER,
    ]
    for kat, n, ts in rows:
        lines.append(f"{LABELS[kat]};{n};{ts}")
    return "\n".join(lines) + "\n"


def color_for(value: int, max_v: int) -> tuple[int, int, int]:
    if max_v <= 0 or value <= 0:
        return PALETTE[-1]
    t = min(1.0, value / max_v)
    idx = round((1 - t) * (len(PALETTE) - 1))
    return PALETTE[idx]


def aggregate(rows: list[tuple[str, int, str]], field: str):
    grid = [[0] * len(HOURS) for _ in range(7)]
    days = [set() for _ in range(7)]
    for kat, n, ts in rows:
        dt = datetime.strptime(ts, "%Y-%m-%d %H:%M")
        wd = dt.weekday()
        hi = HOURS.index(dt.hour)
        if kat != field:
            continue
        grid[wd][hi] += n
        days[wd].add(dt.date())
    n_days = [len(s) for s in days]
    return grid, n_days


def png_write(path: Path, width: int, height: int, rgb_rows: list[bytes]) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + row for row in rgb_rows)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def fill_rect(buf: list[bytearray], x: int, y: int, w: int, h: int, color: tuple[int, int, int], width: int) -> None:
    r, g, b = color
    for yy in range(y, y + h):
        if yy < 0 or yy >= len(buf):
            continue
        row = buf[yy]
        for xx in range(x, x + w):
            if 0 <= xx < width:
                o = xx * 3
                row[o : o + 3] = bytes((r, g, b))


def draw_heatmaps_png(rows: list[tuple[str, int, str]], path: Path) -> None:
    specs = [("Hinterbliebene", "hinterbliebene"), ("Hausführung", "hausfuehrung"), ("Grabverkauf", "grabverkauf")]
    cell = 18
    pad = 24
    label_w = 8
    col_w = cell + 4
    head = 28
    foot = 22
    block_h = head + len(HOURS) * cell + foot
    width = pad * 2 + label_w + 7 * col_w
    height = pad + len(specs) * (block_h + 20)
    buf = [bytearray(b"\xf5\xf7\xfb" * width) for _ in range(height)]
    for s, (title, field) in enumerate(specs):
        grid, n_days = aggregate(rows, field)
        mx = max(max(col) for col in grid) if rows else 0
        y0 = pad + s * (block_h + 20)
        # title bar
        fill_rect(buf, pad, y0, width - 2 * pad, 18, (28, 28, 30), width)
        fill_rect(buf, pad + 1, y0 + 1, width - 2 * pad - 2, 16, (232, 236, 244), width)
        for d in range(7):
            for hi, hour in enumerate(HOURS):
                # top row = 08:00 → hi 0 at top
                row_from_top = hi
                x = pad + label_w + d * col_w
                y = y0 + head + row_from_top * cell
                fill_rect(buf, x, y, cell - 2, cell - 2, color_for(grid[d][hi], mx), width)
            # weekday tick under column
            avg = (sum(grid[d]) / n_days[d]) if n_days[d] else 0
            # darker foot mark; length encodes that a label belongs here
            fx = pad + label_w + d * col_w
            fy = y0 + head + len(HOURS) * cell + 4
            fill_rect(buf, fx, fy, cell - 2, 6, (60, 60, 67), width)
            if avg >= 2:
                fill_rect(buf, fx, fy, cell - 2, 6, (248, 105, 107), width)
            elif avg >= 1:
                fill_rect(buf, fx, fy, cell - 2, 6, (254, 216, 128), width)
            else:
                fill_rect(buf, fx, fy, cell - 2, 6, (99, 190, 123), width)
    png_write(path, width, height, [bytes(r) for r in buf])


CSS = r"""
    .visitor-card h2 { margin-bottom: 6px; }
    .visitor-legend {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 4px 0 10px;
      font-size: 0.75rem;
      color: var(--text-secondary);
    }
    .visitor-legend-scale {
      display: flex;
      height: 10px;
      width: 92px;
      border-radius: 4px;
      overflow: hidden;
      border: 1px solid rgba(0,0,0,0.08);
    }
    .visitor-legend-scale span { flex: 1; }
    .visitor-heatmap-wrap {
      display: flex;
      align-items: stretch;
      gap: 8px;
      width: fit-content;
      max-width: 100%;
    }
    .visitor-hours {
      display: flex;
      flex-direction: column;
      justify-content: stretch;
      padding-top: 0;
      padding-bottom: 2.1rem;
    }
    .visitor-hour {
      flex: 1;
      display: flex;
      align-items: center;
      font-size: 0.62rem;
      line-height: 1;
      color: var(--text-secondary);
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .visitor-cols {
      display: flex;
      gap: 0;
    }
    .visitor-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      min-width: 2.4rem;
    }
    .visitor-cells {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .visitor-cell {
      width: 22px;
      height: 18px;
      border-radius: 3px;
      box-shadow: inset 0 0 0 1px rgba(0,0,0,0.06);
    }
    .visitor-day {
      font-size: 0.68rem;
      font-weight: 600;
      color: var(--text);
      text-align: center;
      line-height: 1.2;
      min-height: 2.2rem;
    }
    .visitor-day span { display: block; }
    @media (max-width: 520px) {
      .visitor-cell { width: 16px; height: 14px; }
      .visitor-hour { font-size: 0.55rem; }
      .visitor-day { font-size: 0.6rem; }
      .visitor-col { min-width: 1.85rem; }
    }
"""

HTML_CARDS = r"""
    <section class="card visitor-card" id="visitor-hinterbliebene-card">
      <h2>Hinterbliebene</h2>
      <p class="kpi-sub" id="visitor-hinterbliebene-sub">Lade Besucherdaten …</p>
      <div class="visitor-legend" aria-hidden="true">
        <span>wenige</span>
        <div class="visitor-legend-scale">SCALE</div>
        <span>viele</span>
      </div>
      <div id="visitor-hinterbliebene-heatmap"></div>
    </section>

    <section class="card visitor-card" id="visitor-hausfuehrung-card">
      <h2>Hausführung</h2>
      <p class="kpi-sub" id="visitor-hausfuehrung-sub"></p>
      <div class="visitor-legend" aria-hidden="true">
        <span>wenige</span>
        <div class="visitor-legend-scale">SCALE</div>
        <span>viele</span>
      </div>
      <div id="visitor-hausfuehrung-heatmap"></div>
    </section>

    <section class="card visitor-card" id="visitor-grabverkauf-card">
      <h2>Grabverkauf</h2>
      <p class="kpi-sub" id="visitor-grabverkauf-sub"></p>
      <div class="visitor-legend" aria-hidden="true">
        <span>wenige</span>
        <div class="visitor-legend-scale">SCALE</div>
        <span>viele</span>
      </div>
      <div id="visitor-grabverkauf-heatmap"></div>
    </section>
"""


def legend_html() -> str:
    spans = "".join(f'<span style="background:{rgb_to_hex(c)}"></span>' for c in reversed(PALETTE))
    return spans


def rgb_to_hex(c: tuple[int, int, int]) -> str:
    return "#%02x%02x%02x" % c


def inject(html: str, js: str, csv: str) -> str:
    import re

    cards = HTML_CARDS.replace("SCALE", legend_html())
    html, n_cards = re.subn(
        r'(?:    <section class="card visitor-card" id="visitor-[^"]+-card">[\s\S]*?</section>\s*){3}',
        lambda _m: cards + "\n",
        html,
        count=1,
    )
    if n_cards == 0 and 'id="visitor-hinterbliebene-card"' not in html:
        marker = '    <section class="card error-box" id="error-card" hidden></section>'
        if marker not in html:
            raise SystemExit("error-card Marker nicht gefunden")
        html = html.replace(marker, cards + "\n" + marker, 1)
    if ".visitor-cell" not in html:
        style_end = "  </style>"
        idx = html.find(style_end)
        if idx < 0:
            raise SystemExit("style-Ende nicht gefunden")
        html = html[:idx] + CSS + "\n" + html[idx:]
    else:
        import re
        html = re.sub(
            r"\n    \.visitor-card h2 \{[\s\S]*?@media \(max-width: 520px\) \{[\s\S]*?\n    \}\n",
            "\n" + CSS + "\n",
            html,
            count=1,
        )
    embed = (
        '  <script type="text/csv" id="besucher-data-csv">\n'
        + csv.rstrip()
        + "\n  </script>\n"
    )
    if 'id="besucher-data-csv"' in html:
        import re
        html = re.sub(
            r'  <script type="text/csv" id="besucher-data-csv">[\s\S]*?</script>\n',
            lambda _m: embed,
            html,
            count=1,
        )
    else:
        html = html.replace("<!-- DATEN_EMBED_END -->", embed + "<!-- DATEN_EMBED_END -->", 1)
        if 'id="besucher-data-csv"' not in html:
            html = html.replace("</body>", embed + "</body>", 1)
    script = "<script>\n" + js.strip() + "\n</script>\n"
    if "Besucherstatistik: drei Wochentag" in html:
        import re
        html = re.sub(
            r"<script>\n/\* Besucherstatistik: drei Wochentag[\s\S]*?</script>\n",
            lambda _m: script,
            html,
            count=1,
        )
    else:
        html = html.replace("</body>", script + "</body>", 1)
    html = html.replace("var STATS_BUILD = '2026-09-09a';", "var STATS_BUILD = '2026-09-15-kategorien';")
    html = html.replace("var STATS_BUILD = '2026-09-12-besucher';", "var STATS_BUILD = '2026-09-15-kategorien';")
    return html


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--html", type=Path)
    p.add_argument("--js", type=Path, required=True)
    p.add_argument("--out-csv", type=Path, required=True)
    p.add_argument("--out-png", type=Path, required=True)
    p.add_argument("--out-html", type=Path)
    args = p.parse_args()
    rows = generate_rows()
    csv = csv_text(rows)
    args.out_csv.parent.mkdir(parents=True, exist_ok=True)
    args.out_csv.write_text(csv, encoding="utf-8")
    args.out_png.parent.mkdir(parents=True, exist_ok=True)
    draw_heatmaps_png(rows, args.out_png)
    if args.html:
        html = args.html.read_text(encoding="utf-8")
        js = args.js.read_text(encoding="utf-8")
        patched = inject(html, js, csv)
        dest = args.out_html or args.html
        dest.write_text(patched, encoding="utf-8")
        print("patched", dest, "bytes", dest.stat().st_size)
    print("rows", len(rows), "csv", args.out_csv, "png", args.out_png)
    month_copy = args.out_csv.with_name("besucher-2026-09.csv")
    if args.out_csv.name == "besucher.csv":
        month_copy.write_text(csv, encoding="utf-8")
        print("month", month_copy)


if __name__ == "__main__":
    main()
