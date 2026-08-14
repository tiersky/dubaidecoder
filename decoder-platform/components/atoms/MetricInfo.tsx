"use client";

interface MetricInfoProps {
  metric: { label: string; source?: string; description?: string };
  label?: string;
}

/**
 * Small ⓘ icon that shows the metric's definition and data source in a
 * tooltip. The shared <Tooltip id="metric-tooltip" /> instance is mounted
 * once in DashboardLayout.
 */
export default function MetricInfo({ metric, label }: MetricInfoProps) {
  const title = label ?? metric.label;
  const description = metric.description;
  const source = metric.source;
  if (!description && !source) return null;

  const html = `<div style="max-width:260px;text-align:left"><strong>${title}</strong>${
    description ? `<br/>${description}` : ""
  }${source ? `<br/><em>Source: ${source}</em>` : ""}</div>`;

  return (
    <span
      data-tooltip-id="metric-tooltip"
      data-tooltip-html={html}
      className="inline-flex items-center text-slate-300 hover:text-slate-500 transition-colors cursor-help align-middle"
    >
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
        />
      </svg>
    </span>
  );
}
