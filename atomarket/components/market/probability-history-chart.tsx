import { formatPercent } from "@/lib/domain/format";
import type { ProbabilityHistoryPoint } from "@/lib/domain/types";

interface ProbabilityHistoryChartProps {
  points: ProbabilityHistoryPoint[];
  latestYesProbability: number;
  compact?: boolean;
  showHeader?: boolean;
  domainStartTs?: string;
  domainEndTs?: string;
}

const CHART_WIDTH = 900;
const CHART_HEIGHT = 280;
const PAD_TOP = 20;
const PAD_RIGHT = 52;
const PAD_BOTTOM = 26;
const PAD_LEFT = 10;
const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const DATE_LABEL_WITH_YEAR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function parseTs(value?: string): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function getTimeDomain(
  points: ProbabilityHistoryPoint[],
  domainStartTs?: string,
  domainEndTs?: string,
): { minTs: number; maxTs: number } {
  const times = points
    .map((point) => new Date(point.ts).getTime())
    .filter((value) => Number.isFinite(value));
  const explicitStart = parseTs(domainStartTs);
  const explicitEnd = parseTs(domainEndTs);

  if (times.length === 0) {
    const now = Date.now();
    const baseStart = explicitStart ?? now;
    const baseEnd = explicitEnd ?? now;
    if (baseEnd <= baseStart) return { minTs: baseStart, maxTs: baseStart + 1 };
    return { minTs: baseStart, maxTs: baseEnd };
  }

  const minObserved = Math.min(...times);
  const maxObserved = Math.max(...times);
  const minTs = explicitStart ?? minObserved;
  const maxTs = explicitEnd ?? maxObserved;
  const boundedMinTs = Math.min(minTs, minObserved);
  const boundedMaxTs = Math.max(maxTs, maxObserved);
  return {
    minTs: boundedMinTs,
    maxTs: boundedMaxTs === boundedMinTs ? boundedMinTs + 1 : boundedMaxTs,
  };
}

function xForPoint(ts: string, minTs: number, maxTs: number, innerWidth: number): number {
  const parsed = new Date(ts).getTime();
  if (!Number.isFinite(parsed)) return PAD_LEFT;
  const ratio = (parsed - minTs) / (maxTs - minTs);
  return PAD_LEFT + Math.max(0, Math.min(1, ratio)) * innerWidth;
}

function withDomainEndpoints(
  points: ProbabilityHistoryPoint[],
  minTs: number,
  maxTs: number,
): ProbabilityHistoryPoint[] {
  const normalized = points
    .map((point) => ({ ...point, parsedTs: new Date(point.ts).getTime() }))
    .filter((point) => Number.isFinite(point.parsedTs))
    .sort((a, b) => a.parsedTs - b.parsedTs);

  if (normalized.length === 0) return [];

  const first = normalized[0];
  const last = normalized[normalized.length - 1];
  const extended: ProbabilityHistoryPoint[] = normalized.map(({ ts, yes_probability }) => ({
    ts,
    yes_probability,
  }));

  if (minTs < first.parsedTs) {
    extended.unshift({
      ts: new Date(minTs).toISOString(),
      yes_probability: first.yes_probability,
    });
  }

  if (last.parsedTs < maxTs) {
    extended.push({
      ts: new Date(maxTs).toISOString(),
      yes_probability: last.yes_probability,
    });
  }

  return extended;
}

function buildPath(points: ProbabilityHistoryPoint[], domainStartTs?: string, domainEndTs?: string) {
  const innerWidth = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const { minTs, maxTs } = getTimeDomain(points, domainStartTs, domainEndTs);
  const plottedPoints = withDomainEndpoints(points, minTs, maxTs);

  if (plottedPoints.length <= 1) {
    const y = PAD_TOP + innerHeight * (1 - (plottedPoints[0]?.yes_probability ?? 0.5));
    return `M ${PAD_LEFT} ${y} L ${PAD_LEFT + innerWidth} ${y}`;
  }

  return plottedPoints
    .map((point, index) => {
      const x = xForPoint(point.ts, minTs, maxTs, innerWidth);
      const y = PAD_TOP + innerHeight * (1 - point.yes_probability);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(3)} ${y.toFixed(3)}`;
    })
    .join(" ");
}

export function ProbabilityHistoryChart({
  points,
  latestYesProbability,
  compact = false,
  showHeader = true,
  domainStartTs,
  domainEndTs,
}: ProbabilityHistoryChartProps) {
  const path = buildPath(points, domainStartTs, domainEndTs);
  const { minTs, maxTs } = getTimeDomain(points, domainStartTs, domainEndTs);
  const startDate = new Date(minTs);
  const endDate = new Date(maxTs);
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
          <span>{DATE_LABEL_FORMATTER.format(startDate)}</span>
          <span>{DATE_LABEL_WITH_YEAR_FORMATTER.format(endDate)}</span>
        </div>
      </div>
    </div>
  );
}
