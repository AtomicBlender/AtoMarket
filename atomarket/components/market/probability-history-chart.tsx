import { formatPercent } from "@/lib/domain/format";
import type { ProbabilityHistoryPoint } from "@/lib/domain/types";

interface ProbabilityHistoryChartProps {
  points: ProbabilityHistoryPoint[];
  latestYesProbability: number;
  compact?: boolean;
  showHeader?: boolean;
}

const CHART_WIDTH = 900;
const CHART_HEIGHT = 280;
const PAD_TOP = 20;
const PAD_RIGHT = 52;
const PAD_BOTTOM = 26;
const PAD_LEFT = 10;

function getTimeDomain(points: ProbabilityHistoryPoint[]): { minTs: number; maxTs: number } {
  const times = points
    .map((point) => new Date(point.ts).getTime())
    .filter((value) => Number.isFinite(value));

  if (times.length === 0) {
    const now = Date.now();
    return { minTs: now, maxTs: now + 1 };
  }

  const minTs = Math.min(...times);
  const maxTs = Math.max(...times);
  return {
    minTs,
    maxTs: maxTs === minTs ? minTs + 1 : maxTs,
  };
}

function xForPoint(ts: string, minTs: number, maxTs: number, innerWidth: number): number {
  const parsed = new Date(ts).getTime();
  if (!Number.isFinite(parsed)) return PAD_LEFT;
  const ratio = (parsed - minTs) / (maxTs - minTs);
  return PAD_LEFT + Math.max(0, Math.min(1, ratio)) * innerWidth;
}

function buildPath(points: ProbabilityHistoryPoint[]) {
  const innerWidth = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const { minTs, maxTs } = getTimeDomain(points);

  if (points.length === 1) {
    const y = PAD_TOP + innerHeight * (1 - points[0].yes_probability);
    return `M ${PAD_LEFT} ${y} L ${PAD_LEFT + innerWidth} ${y}`;
  }

  return points
    .map((point, index) => {
      const x = xForPoint(point.ts, minTs, maxTs, innerWidth);
      const y = PAD_TOP + innerHeight * (1 - point.yes_probability);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

export function ProbabilityHistoryChart({
  points,
  latestYesProbability,
  compact = false,
  showHeader = true,
}: ProbabilityHistoryChartProps) {
  const path = buildPath(points);
  const startDate = new Date(points[0].ts);
  const endDate = new Date(points[points.length - 1].ts);
  const yTicks = compact ? [1, 0.5, 0] : [1, 0.75, 0.5, 0.25, 0];
  const yTickFontSize = compact ? 15 : 18;
  const chartHeightClass = compact ? "h-[150px] w-full md:h-[170px]" : "h-[240px] w-full md:h-[280px]";
  const containerClass = compact ? "rounded-xl border border-slate-800 bg-slate-950/70 p-3" : "rounded-xl border border-slate-800 bg-slate-950/70 p-4";

  return (
    <div className={containerClass}>
      {showHeader ? (
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Probability history</p>
            <p className="mt-1 text-3xl font-semibold text-sky-400">YES {formatPercent(latestYesProbability)}</p>
          </div>
          <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-300">
            All-time
          </span>
        </div>
      ) : null}

      <div className="relative">
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className={chartHeightClass} role="img" aria-label="YES probability history chart">
          {yTicks.map((tick) => {
            const innerHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
            const y = PAD_TOP + innerHeight * (1 - tick);
            return (
              <g key={tick}>
                <line x1={PAD_LEFT} y1={y} x2={CHART_WIDTH - PAD_RIGHT} y2={y} stroke="#1e293b" strokeDasharray="3 5" />
                <text x={CHART_WIDTH - PAD_RIGHT + 6} y={y + 4.5} fontSize={String(yTickFontSize)} fill="#94a3b8">
                  {Math.round(tick * 100)}%
                </text>
              </g>
            );
          })}

          <path d={path} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>

        <div className={`mt-2 flex items-center justify-between px-1 text-xs text-slate-500 ${compact ? "text-[11px]" : ""}`}>
          <span>{startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          <span>{endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        </div>
      </div>
    </div>
  );
}
