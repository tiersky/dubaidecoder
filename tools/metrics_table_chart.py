"""Render the HNW metrics table as a polished JPEG."""

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle
import numpy as np

# (country, GWI HNW, UHNWI+$30M, RE ownership %, Proximity (inverted),
#  High Sav/Inv %, Market Tier, Total Population, Weighted Score)
rows = [
    ("UK",            3_715_646,  27_876, 0.286, 5290, 0.83, 3.00,    69_931_528, 43.60),
    ("USA",          28_829_667, 251_832, 0.246, 8700, 0.79, 2.00,   360_000_000, 54.48),
    ("India",        32_826_437,  12_161, 0.381, 1710, 0.52, 3.00, 1_476_625_576, 78.71),
    ("Egypt",         3_599_912,     822, 0.258, 3280, 0.30, 1.00,   120_101_000, 33.33),
    ("Russia",        7_755_950,   8_399, 0.282, 4080, 0.35, 3.00,   143_394_458, 42.23),
    ("China",        41_788_688, 121_677, 0.355, 3640, 0.74, 3.00, 1_420_000_000, 81.00),
    ("UAE",             445_002,   4_851, 0.392, 1890, 0.93, 2.00,    11_574_682, 62.62),
    ("Indonesia",     6_004_462,   3_833, 0.263, 2410, 0.78, 1.00,   283_500_000, 46.49),
    ("Philippines",   2_956_209,   1_910, 0.207, 3310, 0.67, 1.00,   121_000_000, 33.82),
    ("Saudi Arabia",    758_493,   4_388, 0.349, 2280, 0.83, 2.00,    35_300_000, 57.07),
    ("Turkey",       15_169_513,   4_208, 0.181, 3540, 0.55, 1.00,    90_000_000, 37.68),
    ("Vietnam",       2_811_005,   1_233, 0.411, 2460, 0.82, 1.00,   102_000_000, 57.13),
]

headers = [
    "Country",
    "HNW Audience\n(GWI)",
    "UHNWI 2026\n(+$30M)",
    "RE Ownership\nfor HNW",
    "Proximity to\nMaldives (inv.)",
    "High Savings\n/Investment",
    "Market Tier\n(KSA & UAE)",
    "Total\nPopulation",
    "Weighted\nScore",
]
col_widths = [0.115, 0.115, 0.10, 0.095, 0.10, 0.105, 0.14, 0.12, 0.11]
assert abs(sum(col_widths) - 1.0) < 1e-9

# Pre-format display values
def fmt_int(x): return f"{int(x):,}"
def fmt_pct(x): return f"{x*100:.1f}%"
def fmt_tier(x): return f"{x:.2f}"

display = []
for r in rows:
    country, gwi, uhnwi, re_own, prox, hsav, tier, pop, wscore = r
    display.append([
        country,
        fmt_int(gwi),
        fmt_int(uhnwi),
        fmt_pct(re_own),
        fmt_int(prox),
        fmt_pct(hsav),
        fmt_tier(tier),
        fmt_int(pop) if pop is not None else "—",
        f"{wscore:.2f}",
    ])

# Layout
n_rows = len(rows)
fig_w, fig_h = 17, 9
fig = plt.figure(figsize=(fig_w, fig_h), dpi=200)
fig.patch.set_facecolor("#f8fafc")

# Card
card_ax = fig.add_axes([0.02, 0.02, 0.96, 0.96])
card_ax.set_xlim(0, 1); card_ax.set_ylim(0, 1); card_ax.axis("off")
card_ax.add_patch(FancyBboxPatch(
    (0.003, 0.003), 0.994, 0.994,
    boxstyle="round,pad=0.0,rounding_size=0.018",
    linewidth=1, edgecolor="#e2e8f0", facecolor="white",
))

# Title
fig.text(0.05, 0.945, "Country Metrics — Demand-Side Drivers",
         fontsize=20, fontweight="600", color="#0f172a", family="DejaVu Sans")
fig.text(0.05, 0.918, "Inputs and weights underlying the budget allocation model (12 markets)",
         fontsize=11, color="#64748b", family="DejaVu Sans")

# Table area
tbl_ax = fig.add_axes([0.04, 0.05, 0.92, 0.85])
tbl_ax.set_xlim(0, 1); tbl_ax.set_ylim(0, 1); tbl_ax.axis("off")

# Compute column x-edges
x_edges = [0.0]
for w in col_widths:
    x_edges.append(x_edges[-1] + w)

# Header band
header_h = 0.10
header_y0 = 1.0 - header_h
tbl_ax.add_patch(Rectangle(
    (0, header_y0), 1, header_h, facecolor="#f1f5f9", edgecolor="none",
))

# Header text
for i, h in enumerate(headers):
    cx = (x_edges[i] + x_edges[i + 1]) / 2
    align = "left" if i == 0 else "center"
    x_text = (x_edges[i] + 0.012) if i == 0 else cx
    tbl_ax.text(
        x_text, header_y0 + header_h / 2, h,
        fontsize=9.5, color="#475569", fontweight="600",
        ha=align, va="center", family="DejaVu Sans",
    )

# Header bottom border
tbl_ax.plot([0, 1], [header_y0, header_y0], color="#cbd5e1", linewidth=1.2)

# Rows
row_h = header_y0 / n_rows  # fills the remaining vertical space
# Color tier
TIER_COLORS = {
    1.0: "#fee2e2",  # red-100 light
    2.0: "#fef3c7",  # amber-100 light
    3.0: "#dcfce7",  # green-100 light
}
TIER_TEXT = {
    1.0: "#b91c1c",
    2.0: "#b45309",
    3.0: "#15803d",
}

# For data bars on % and large-value columns we'll compute per-column max
gwi_vals   = [r[1] for r in rows]
uhnwi_vals = [r[2] for r in rows]
pop_vals   = [r[7] if r[7] is not None else 0 for r in rows]
re_vals    = [r[3] for r in rows]
hsav_vals  = [r[5] for r in rows]
prox_vals  = [r[4] for r in rows]

# Heatmap palette mirroring the source spreadsheet (red → green)
def score_color(score, vmin=30.0, vmax=82.0):
    t = max(0.0, min(1.0, (score - vmin) / (vmax - vmin)))
    # Anchor stops (t, RGB)
    stops = [
        (0.00, (0.96, 0.42, 0.42)),  # red  (#F56B6B)
        (0.25, (0.98, 0.62, 0.40)),  # orange
        (0.50, (0.97, 0.90, 0.45)),  # yellow
        (0.70, (0.71, 0.86, 0.45)),  # light green
        (1.00, (0.40, 0.75, 0.46)),  # green
    ]
    for i in range(len(stops) - 1):
        t0, c0 = stops[i]
        t1, c1 = stops[i + 1]
        if t <= t1:
            f = 0.0 if t1 == t0 else (t - t0) / (t1 - t0)
            return tuple(c0[k] + (c1[k] - c0[k]) * f for k in range(3))
    return stops[-1][1]

def bar_in_cell(ax, x0, x1, y0, y1, frac, color):
    pad_x = 0.006
    pad_y = (y1 - y0) * 0.30
    inner_x0 = x0 + pad_x
    inner_x1 = x1 - pad_x
    width = (inner_x1 - inner_x0) * max(0.0, min(frac, 1.0))
    ax.add_patch(Rectangle(
        (inner_x0, y0 + pad_y), width, (y1 - y0) - 2 * pad_y,
        facecolor=color, edgecolor="none", alpha=0.55, zorder=1,
    ))

for r_idx, row in enumerate(display):
    y1 = header_y0 - r_idx * row_h
    y0 = y1 - row_h
    # Zebra striping
    if r_idx % 2 == 1:
        tbl_ax.add_patch(Rectangle(
            (0, y0), 1, row_h, facecolor="#fafbfc", edgecolor="none",
        ))

    raw = rows[r_idx]
    _, gwi, uhnwi, re_own, prox, hsav, tier, pop, wscore = raw

    # Weighted Score heatmap cell — fills the entire cell
    score_idx = 8
    sx0, sx1 = x_edges[score_idx], x_edges[score_idx + 1]
    pad_y = row_h * 0.10
    pad_x = 0.004
    tbl_ax.add_patch(FancyBboxPatch(
        (sx0 + pad_x, y0 + pad_y),
        (sx1 - sx0) - 2 * pad_x, row_h - 2 * pad_y,
        boxstyle="round,pad=0.0,rounding_size=0.008",
        linewidth=0, facecolor=score_color(wscore), zorder=1,
    ))

    # Data bars (subtle blue)
    # 1: GWI HNW
    bar_in_cell(tbl_ax, x_edges[1], x_edges[2], y0, y1, gwi / max(gwi_vals), "#bfdbfe")
    # 2: UHNWI
    bar_in_cell(tbl_ax, x_edges[2], x_edges[3], y0, y1, uhnwi / max(uhnwi_vals), "#bfdbfe")
    # 3: RE Ownership %
    bar_in_cell(tbl_ax, x_edges[3], x_edges[4], y0, y1, re_own / max(re_vals), "#a7f3d0")
    # 4: Proximity inverted (higher = farther, so smaller = better, but we just visualise magnitude)
    bar_in_cell(tbl_ax, x_edges[4], x_edges[5], y0, y1, prox / max(prox_vals), "#fde68a")
    # 5: High Savings/Investment %
    bar_in_cell(tbl_ax, x_edges[5], x_edges[6], y0, y1, hsav / max(hsav_vals), "#a7f3d0")
    # 7: Population
    if pop is not None and max(pop_vals) > 0:
        bar_in_cell(tbl_ax, x_edges[7], x_edges[8], y0, y1, pop / max(pop_vals), "#c7d2fe")

    # Tier pill (col idx 6)
    pill_color = TIER_COLORS.get(tier, "#e2e8f0")
    pill_text  = TIER_TEXT.get(tier, "#334155")
    pill_w = 0.045
    pill_cx = (x_edges[6] + x_edges[7]) / 2
    pill_h = row_h * 0.55
    tbl_ax.add_patch(FancyBboxPatch(
        (pill_cx - pill_w / 2, (y0 + y1) / 2 - pill_h / 2),
        pill_w, pill_h,
        boxstyle="round,pad=0.0,rounding_size=0.012",
        linewidth=0, facecolor=pill_color,
    ))
    tbl_ax.text(pill_cx, (y0 + y1) / 2, f"Tier {int(tier)}",
                fontsize=9, fontweight="600", color=pill_text,
                ha="center", va="center", family="DejaVu Sans")

    # Cell texts
    for c_idx, val in enumerate(row):
        if c_idx == 6:
            continue  # rendered as pill
        if c_idx == 0:
            x_text = x_edges[c_idx] + 0.012
            align = "left"
            weight = "600"
            color = "#0f172a"
        else:
            x_text = x_edges[c_idx + 1] - 0.012
            align = "right"
            weight = "500"
            color = "#334155"
        tbl_ax.text(
            x_text, (y0 + y1) / 2, val,
            fontsize=10.5, color=color, fontweight=weight,
            ha=align, va="center", family="DejaVu Sans", zorder=2,
        )

    # Row separator
    tbl_ax.plot([0, 1], [y0, y0], color="#eef2f7", linewidth=0.8)

# Footnote
fig.text(0.05, 0.035,
         "Source: GWI · UHNWI 2026 projections · Distance data inverted so higher = farther from Maldives.",
         fontsize=9, color="#94a3b8", style="italic", family="DejaVu Sans")

out = "/Users/emre.kaya/Desktop/projects/abudhabi/country_metrics_table.jpg"
plt.savefig(out, format="jpg", dpi=200, facecolor=fig.get_facecolor(),
            bbox_inches="tight", pil_kwargs={"quality": 95})
print(f"Saved: {out}")
