import Link from "next/link";
import { formatDateTime, formatNeutrons } from "@/lib/domain/format";
import type { AdminUserRow } from "@/lib/domain/types";

function userLabel(user: AdminUserRow): string {
  return user.display_name?.trim() || user.username || `user_${user.user_id.slice(0, 8)}`;
}

function activityLabel(user: AdminUserRow): string {
  if (!user.last_trade_at) return "No trades";
  return `Last trade ${formatDateTime(user.last_trade_at)}`;
}

export function AdminUsersTable({
  users,
  totalCount,
}: {
  users: AdminUserRow[];
  totalCount: number;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/75">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Users</h2>
          <p className="text-sm text-slate-400">Showing {users.length} of {totalCount} matching users.</p>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="px-5 py-8 text-sm text-slate-400">No users match the current filters.</div>
      ) : (
        <div className="divide-y divide-slate-800">
          {users.map((user) => (
            <article key={user.user_id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1.5fr)_0.75fr_0.9fr_0.85fr] lg:items-center">
              <div className="min-w-0">
                {user.username ? (
                  <Link
                    href={`/u/${user.username}`}
                    className="block break-words text-base font-medium text-emerald-300 [overflow-wrap:anywhere] hover:text-emerald-200 lg:truncate"
                  >
                    {userLabel(user)}
                  </Link>
                ) : (
                  <p className="break-words text-base font-medium text-slate-100 [overflow-wrap:anywhere] lg:truncate">
                    {userLabel(user)}
                  </p>
                )}
                <p className="mt-1 break-words text-xs text-slate-500 [overflow-wrap:anywhere]">
                  {user.username ? `@${user.username} · ` : ""}{user.is_admin ? "Admin" : "Member"} · {user.is_active ? "Active" : "Inactive"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {!user.is_active ? (
                    <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-rose-200">Inactive</span>
                  ) : null}
                  {user.is_admin ? (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-200">Admin</span>
                  ) : null}
                  {user.trades_count === 0 ? (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-200">No trades</span>
                  ) : null}
                </div>
              </div>
              <div className="text-sm text-slate-300">
                <p className="font-medium text-slate-100">{formatNeutrons(user.neutron_balance ?? 0)} neutrons</p>
                <p className="mt-1 text-xs text-slate-500">Joined {formatDateTime(user.created_at)}</p>
                <p className="mt-1 text-xs text-slate-500">{activityLabel(user)}</p>
              </div>
              <div className="grid gap-1 text-sm text-slate-300">
                <p>Trades {formatNeutrons(user.trades_count ?? 0)}</p>
                <p>Markets {formatNeutrons(user.created_markets_count ?? 0)}</p>
                <p>Open positions {formatNeutrons(user.open_positions_count ?? 0)}</p>
              </div>
              <div className="text-sm text-slate-400 lg:text-right">
                <p className="text-slate-200">{user.user_id.slice(0, 8)}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
