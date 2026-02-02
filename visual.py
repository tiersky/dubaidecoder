# Emirates Scam Ad Detector – editable workflow diagram (PNG + SVG, transparent bg)
# Tweak nodes, colors, and edges in the CONFIG block.
from graphviz import Digraph

TITLE = "WORKFLOW: EMIRATES SCAM AD DETECTOR"

# ---- CONFIG: colors, fonts, nodes, edges ----
PALETTE = {
    "stage": "#DCE9FF",   # light blue
    "ingest": "#C7E7E0",  # teal
    "merge": "#CFEDEA",   # aqua
    "filter": "#FFE5A8",  # yellow
    "action": "#CAD8FF",  # blue
    "report": "#C9D7FF",  # bluish
    "db": "#CFDAFF",      # bluish
    "title": "#1F2937"    # dark text
}
FONT = {"family": "Helvetica", "size": "12", "title_size": "20"}

# id -> (label, theme_key)
NODES = {
    "title":    (f"<<B>{TITLE}</B>>", "stage"),
    "schedule": ("⏰ Schedule Trigger\nEvery 6 hours", "stage"),
    "config":   ("📁 Load Config & Seeds", "stage"),
    "meta":     ("🔗 Meta Ads API", "ingest"),
    "tiktok":   ("🔗 TikTok Ads API", "ingest"),
    "merge":    ("🧩 Merge Results\n\n<b>Initial Filter Rules</b>\n• Scam trigger terms\n• Domain allowlist check\n• Page age < 90 days\n• High spend anomaly", "merge"),
    "mlfilter": ("🧠 OpenAI ML Classifier\n• Scam probability scoring\n• Features analysis", "action"),
    "highrisk": ("🟨 Filter High-Risk Ads\nScore > 0.7 threshold", "filter"),
    "sheets":   ("📄 Google Sheets\n• Review queue\n• Human validation", "action"),
    "digest":   ("✉️ Weekly Digest\n• Email summary\n• Slack alert", "action"),
    "report":   ("🚨 Report to APIs\n• Meta Brand Rights\n• TikTok IP Portal", "report"),
    "logdb":    ("💾 Log Database\n• Case tracking\n• Audit trail", "db"),
}

# Edges (source, target) — matches your flow:
EDGES = [
    ("schedule", "config"),
    ("config", "meta"),
    ("config", "tiktok"),
    ("meta", "merge"),
    ("tiktok", "merge"),      # TikTok connects ONLY to Merge Results
    ("merge", "mlfilter"),
    ("mlfilter", "highrisk"),
    ("highrisk", "sheets"),
    ("sheets", "digest"),
    ("highrisk", "report"),
    ("report", "logdb"),
]

# ---- Build graph ----
g = Digraph("emirates_workflow", format="png")
g.attr(rankdir="TB", splines="ortho", nodesep="0.45", ranksep="0.6", bgcolor="transparent")
g.attr("node", shape="rect", style="rounded,filled", fontname=FONT["family"], fontsize=FONT["size"],
       color="#0F172A", penwidth="1.2")
g.attr("edge", color="#0F172A", arrowsize="0.7")

# Title (plaintext, big)
with g.subgraph(name="cluster_title") as c:
    c.attr(rank="same", color="transparent")
    c.node("title", NODES["title"][0], shape="plaintext",
           fontsize=FONT["title_size"], fontcolor=PALETTE["title"])

def draw_node(node_id, label, theme_key):
    fill = PALETTE.get(theme_key, "#FFFFFF")
    # If already an HTML-like label (e.g., "<<B>..."):
    if isinstance(label, str) and label.startswith("<<") and label.endswith(">>"):
        g.node(node_id, label=label, fillcolor=fill)
    else:
        safe = (label.replace("&", "&amp;")
                     .replace("<", "&lt;")
                     .replace(">", "&gt;")
                     .replace("\n", "<BR/>"))
        g.node(node_id, label=f"<{safe}>", fillcolor=fill)

for nid in ["schedule", "config", "meta", "tiktok", "merge", "mlfilter", "highrisk",
            "sheets", "digest", "report", "logdb"]:
    draw_node(nid, NODES[nid][0], NODES[nid][1])

# Keep title anchored top
g.edge("title", "schedule", style="invis")

# Edges
for a, b in EDGES:
    g.edge(a, b)

# Export
g.render("emirates_workflow")        # emirates_workflow.png (transparent)
g.format = "svg"
g.render("emirates_workflow")        # emirates_workflow.svg
