import { formatNeutrons } from "@/lib/domain/format";
import type { AdminOverviewStats } from "@/lib/domain/types";

function StatCard({
  label,
  value,
  tone = "default",
  detail,
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warn";
  detail?: string;
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/25 bg-emerald-500/10"
      : tone === "warn"
        ? "border-amber-500/25 bg-amber-500/10"
        : "border-slate-800 bg-slate-900/75";

  return (
    <article className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-100">{value}</p>
      {detail ? <p className="mt-1 text-sm text-slate-400">{detail}</p> : null}
    </article>
  );
}

export function AdminStatGrid({ stats }: { stats: AdminOverviewStats | null }) {
  if (!stats) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 text-sm text-slate-400">
        Admin metrics are unavailable.
      </div>
    );
  }

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Users"
        value={formatNeutrons(stats.total_users)}
        detail={`${formatNeutrons(stats.active_users_7d)} active in 7d · ${formatNeutrons(stats.active_users_30d)} in 30d`}
      />
      <StatCard
        label="Markets"
        value={formatNeutrons(stats.total_markets)}
        detail={`${formatNeutrons(stats.open_markets)} open · ${formatNeutrons(stats.resolving_markets)} resolving`}
      />
      <StatCard
        label="Attention"
        value={formatNeutrons(stats.open_disputes + stats.overdue_unresolved_markets + stats.markets_nearing_deadline)}
        tone="warn"
        detail={`${formatNeutrons(stats.open_disputes)} disputes · ${formatNeutrons(stats.overdue_unresolved_markets)} overdue`}
      />
      <StatCard
        label="Volume"
        value={formatNeutrons(stats.total_volume_neutrons)}
        tone="success"
        detail={`${formatNeutrons(stats.resolved_markets)} resolved · ${formatNeutrons(stats.invalid_markets)} invalid`}
      />
    </section>
  );
}
