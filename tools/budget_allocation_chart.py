"""Generate a country-decoder style budget allocation chart as JPEG."""

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
import matplotlib.patheffects as path_effects
import numpy as np

# Data: (country, % split, budget AED)
data = [
    ("China",        12.9, 1_289_481),
    ("India",        12.5, 1_252_941),
    ("UAE",          10.0,   996_889),
    ("Saudi Arabia",  9.1,   908_514),
    ("Vietnam",       9.1,   909_517),
    ("USA",           8.7,   867_231),
    ("Indonesia",     7.4,   740_103),
    ("UK",            6.9,   694_139),
    ("Russia",        6.7,   672_231),
    ("Turkey",        6.0,   599_884),
    ("Philippines",   5.4,   538_433),
    ("Egypt",         5.3,   530_637),
]

# Country-decoder palette (from BudgetPieChart.tsx)
COLORS = [
    "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
    "#06b6d4", "#f97316", "#ec4899", "#14b8a6", "#6366f1",
    "#84cc16", "#e11d48",
]

# Sort desc to match the component
data_sorted = sorted(data, key=lambda x: -x[1])
labels   = [d[0] for d in data_sorted]
shares   = [d[1] for d in data_sorted]
budgets  = [d[2] for d in data_sorted]
total    = sum(budgets)

# Figure with a soft, glass-card-ish background
fig = plt.figure(figsize=(14, 9), dpi=200)
fig.patch.set_facecolor("#f8fafc")  # slate-50

# Card area
card_ax = fig.add_axes([0.03, 0.03, 0.94, 0.94])
card_ax.set_xlim(0, 1); card_ax.set_ylim(0, 1)
card_ax.axis("off")
card = FancyBboxPatch(
    (0.005, 0.005), 0.99, 0.99,
    boxstyle="round,pad=0.0,rounding_size=0.025",
    linewidth=1, edgecolor="#e2e8f0", facecolor="white",
)
card_ax.add_patch(card)

# Title
fig.text(0.075, 0.93, "Budget Distribution",
         fontsize=22, fontweight="600", color="#0f172a",
         family="DejaVu Sans")
fig.text(0.075, 0.895, f"Total budget: AED {total:,.0f}",
         fontsize=12, color="#64748b", family="DejaVu Sans")

# Pie chart on the left
pie_ax = fig.add_axes([0.06, 0.08, 0.5, 0.78])
pie_ax.set_facecolor("white")

def autopct_fmt(pct):
    return f"{pct:.0f}%" if pct >= 6 else ""

wedges, texts, autotexts = pie_ax.pie(
    shares,
    labels=None,
    colors=COLORS[:len(shares)],
    startangle=90,
    counterclock=False,
    autopct=autopct_fmt,
    pctdistance=0.75,
    wedgeprops=dict(edgecolor="white", linewidth=2),
    textprops=dict(family="DejaVu Sans"),
)
for at in autotexts:
    at.set_color("white")
    at.set_fontweight("bold")
    at.set_fontsize(11)
    at.set_path_effects([path_effects.withStroke(linewidth=1.5, foreground=(0, 0, 0, 0.15))])

# Legend / table on the right
legend_ax = fig.add_axes([0.58, 0.08, 0.38, 0.78])
legend_ax.set_xlim(0, 1); legend_ax.set_ylim(0, 1)
legend_ax.axis("off")

# Header row
legend_ax.text(0.08, 0.965, "Country",        fontsize=10, color="#94a3b8",
               fontweight="500", family="DejaVu Sans")
legend_ax.text(0.55, 0.965, "% Split",        fontsize=10, color="#94a3b8",
               fontweight="500", family="DejaVu Sans", ha="right")
legend_ax.text(1.00, 0.965, "Budget (AED)",   fontsize=10, color="#94a3b8",
               fontweight="500", family="DejaVu Sans", ha="right")
legend_ax.plot([0.0, 1.0], [0.945, 0.945], color="#e2e8f0", linewidth=1)

n = len(labels)
row_h = 0.91 / n
for i, (lab, pct, bud) in enumerate(zip(labels, shares, budgets)):
    y = 0.93 - (i + 1) * row_h + row_h * 0.5
    # Colored dot
    legend_ax.scatter(0.025, y, s=90, color=COLORS[i], zorder=3,
                      edgecolor="white", linewidth=1.2)
    legend_ax.text(0.08, y, lab, fontsize=12, color="#334155",
                   va="center", family="DejaVu Sans", fontweight="500")
    legend_ax.text(0.55, y, f"{pct:.1f}%", fontsize=12, color="#475569",
                   va="center", ha="right", family="DejaVu Sans")
    legend_ax.text(1.00, y, f"AED {bud:,.0f}", fontsize=12, color="#0f172a",
                   va="center", ha="right", family="DejaVu Sans",
                   fontweight="600")
    # Faint row separator
    if i < n - 1:
        sep_y = 0.93 - (i + 1) * row_h
        legend_ax.plot([0.0, 1.0], [sep_y, sep_y], color="#f1f5f9", linewidth=0.8)

# Footnote
fig.text(0.075, 0.04,
         "Country Decoder · Budget allocation by % split",
         fontsize=9, color="#94a3b8", style="italic", family="DejaVu Sans")

out = "/Users/emre.kaya/Desktop/projects/abudhabi/budget_allocation_chart.jpg"
plt.savefig(out, format="jpg", dpi=200, facecolor=fig.get_facecolor(),
            bbox_inches="tight", pil_kwargs={"quality": 95})
print(f"Saved: {out}")
