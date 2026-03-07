import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminOverviewPanels } from "@/components/admin/admin-overview-panels";
import { AdminMarketsTable } from "@/components/admin/admin-markets-table";
import { AdminStatGrid } from "@/components/admin/admin-stat-grid";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { AdminUsersTable } from "@/components/admin/admin-users-table";
import { MarketHeader } from "@/components/market/header";
import { AdminControls } from "@/components/market/admin-controls";
import { countdownTo, formatDateTime } from "@/lib/domain/format";
import {
  getAdminDisputes,
  getAdminMarkets,
  getAdminOverview,
  getAdminRecentActions,
  getAdminUsers,
  getMarketById,
  getProfile,
  getViewer,
} from "@/lib/actions/query";

export const dynamic = "force-dynamic";

const MARKET_PAGE_SIZE = 25;
const MARKET_PAGE_MAX = 100;
const USER_PAGE_SIZE = 25;
const USER_PAGE_MAX = 100;

type AdminPageProps = {
  searchParams?: Promise<{
    tab?: string;
    market_status?: string;
    attention?: string;
    category?: string;
    search?: string;
    market_count?: string;
    user_search?: string;
    role?: string;
    state?: string;
    activity?: string;
    user_count?: string;
  }>;
};

function clampCount(value: string | undefined, min: number, max: number): number {
  const parsed = Number(value ?? min);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function asTab(value?: string): "overview" | "markets" | "users" | "disputes" {
  if (value === "markets" || value === "users" || value === "disputes") return value;
  return "overview";
}

function messageForError(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected admin data error.";
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const tab = asTab(params?.tab);
  const marketCount = clampCount(params?.market_count, MARKET_PAGE_SIZE, MARKET_PAGE_MAX);
  const userCount = clampCount(params?.user_count, USER_PAGE_SIZE, USER_PAGE_MAX);

  const user = await getViewer();
  if (!user) {
    redirect("/auth/login?next=/admin");
  }

  const profile = await getProfile(user.id);
  if (!profile?.is_admin) {
    return (
      <main>
        <MarketHeader />
        <section className="mx-auto max-w-4xl px-4 py-10">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 text-slate-300">
            Admin access required.
          </div>
        </section>
      </main>
    );
  }

  const [overviewResult, recentActionsResult, disputesResult, attentionMarketsResult, marketsResultData, usersResultData] =
    await Promise.allSettled([
      getAdminOverview(),
      getAdminRecentActions(8),
      getAdminDisputes(),
      getAdminMarkets({ attention: "ALL" }, 6, 0),
      getAdminMarkets(
        {
          status: params?.market_status ?? "ALL",
          attention: params?.attention ?? "ALL",
          category: params?.category ?? "",
          search: params?.search ?? "",
        },
        marketCount,
        0,
      ),
      getAdminUsers(
        {
          search: params?.user_search ?? "",
          role: params?.role ?? "ALL",
          state: params?.state ?? "ALL",
          activity: params?.activity ?? "ALL",
        },
        userCount,
        0,
      ),
    ]);

  const overview = overviewResult.status === "fulfilled" ? overviewResult.value : null;
  const overviewError = overviewResult.status === "rejected" ? messageForError(overviewResult.reason) : null;
  const recentActions = recentActionsResult.status === "fulfilled" ? recentActionsResult.value : [];
  const recentActionsError =
    recentActionsResult.status === "rejected" ? messageForError(recentActionsResult.reason) : null;
  const disputes = disputesResult.status === "fulfilled" ? disputesResult.value : [];
  const disputesError = disputesResult.status === "rejected" ? messageForError(disputesResult.reason) : null;
  const attentionMarkets =
    attentionMarketsResult.status === "fulfilled"
      ? attentionMarketsResult.value
      : { markets: [], totalCount: 0 };
  const attentionMarketsError =
    attentionMarketsResult.status === "rejected" ? messageForError(attentionMarketsResult.reason) : null;
  const marketsResult =
    marketsResultData.status === "fulfilled"
      ? marketsResultData.value
      : { markets: [], totalCount: 0 };
  const marketsError = marketsResultData.status === "rejected" ? messageForError(marketsResultData.reason) : null;
  const usersResult =
    usersResultData.status === "fulfilled"
      ? usersResultData.value
      : { users: [], totalCount: 0 };
  const usersError = usersResultData.status === "rejected" ? messageForError(usersResultData.reason) : null;

  const disputeRows =
    disputesError == null
      ? await Promise.all(
          disputes.map(async (dispute) => ({
            dispute,
            market: await getMarketById(dispute.market_id),
          })),
        )
      : [];

  function buildHref(nextTab: string) {
    const query = new URLSearchParams();
    if (nextTab !== "overview") query.set("tab", nextTab);
    if (params?.market_status && params.market_status !== "ALL") query.set("market_status", params.market_status);
    if (params?.attention && params.attention !== "ALL") query.set("attention", params.attention);
    if (params?.category) query.set("category", params.category);
    if (params?.search) query.set("search", params.search);
    if (params?.market_count && params.market_count !== String(MARKET_PAGE_SIZE)) query.set("market_count", params.market_count);
    if (params?.user_search) query.set("user_search", params.user_search);
    if (params?.role && params.role !== "ALL") query.set("role", params.role);
    if (params?.state && params.state !== "ALL") query.set("state", params.state);
    if (params?.activity && params.activity !== "ALL") query.set("activity", params.activity);
    if (params?.user_count && params.user_count !== String(USER_PAGE_SIZE)) query.set("user_count", params.user_count);
    const suffix = query.toString();
    return suffix ? `/admin?${suffix}` : "/admin";
  }

  const nextMarketCount = Math.min(MARKET_PAGE_MAX, marketCount + MARKET_PAGE_SIZE);
  const nextUserCount = Math.min(USER_PAGE_MAX, userCount + USER_PAGE_SIZE);
  const marketHasMore = marketsResult.markets.length < marketsResult.totalCount;
  const userHasMore = usersResult.users.length < usersResult.totalCount;

  const nextMarketParams = new URLSearchParams();
  nextMarketParams.set("tab", "markets");
  nextMarketParams.set("market_count", String(nextMarketCount));
  if (params?.market_status) nextMarketParams.set("market_status", params.market_status);
  if (params?.attention) nextMarketParams.set("attention", params.attention);
  if (params?.category) nextMarketParams.set("category", params.category);
  if (params?.search) nextMarketParams.set("search", params.search);

  const nextUserParams = new URLSearchParams();
  nextUserParams.set("tab", "users");
  nextUserParams.set("user_count", String(nextUserCount));
  if (params?.user_search) nextUserParams.set("user_search", params.user_search);
  if (params?.role) nextUserParams.set("role", params.role);
  if (params?.state) nextUserParams.set("state", params.state);
  if (params?.activity) nextUserParams.set("activity", params.activity);

  return (
    <main>
      <MarketHeader />
      <section className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Admin Console</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-100">Platform visibility and dispute operations</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Monitor platform health, inspect markets and users, and resolve challenged disputes without leaving the console.
            </p>
          </div>
          <AdminTabs activeTab={tab} buildHref={buildHref} />
        </div>

        <AdminStatGrid stats={overview} />
        {overviewError ? (
          <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 p-4 text-sm text-rose-100">
            {overviewError}
          </div>
        ) : null}

        {tab === "overview" ? (
          <>
            {attentionMarketsError || disputesError || recentActionsError ? (
              <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 p-4 text-sm text-rose-100">
                {[attentionMarketsError, disputesError, recentActionsError].filter(Boolean).join(" ")}
              </div>
            ) : null}
            <AdminOverviewPanels
              attentionMarkets={attentionMarkets.markets}
              disputes={disputes}
              recentActions={recentActions}
            />
          </>
        ) : null}

        {tab === "markets" ? (
          <div className="space-y-4">
            <form className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
              <input type="hidden" name="tab" value="markets" />
              <input type="hidden" name="market_count" value={String(MARKET_PAGE_SIZE)} />
              <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_0.9fr_0.8fr_0.5fr]">
                <input
                  name="search"
                  defaultValue={params?.search ?? ""}
                  placeholder="Search market or creator"
                  className="h-11 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                />
                <select
                  name="market_status"
                  defaultValue={params?.market_status ?? "ALL"}
                  className="h-11 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                >
                  <option value="ALL">All statuses</option>
                  <option value="OPEN">OPEN</option>
                  <option value="CLOSED">CLOSED</option>
                  <option value="RESOLVING">RESOLVING</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="INVALID_REFUND">INVALID REFUND</option>
                </select>
                <select
                  name="attention"
                  defaultValue={params?.attention ?? "ALL"}
                  className="h-11 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                >
                  <option value="ALL">All attention states</option>
                  <option value="CHALLENGED">Challenged</option>
                  <option value="OVERDUE">Past close</option>
                  <option value="DEADLINE">Deadline within 24h</option>
                  <option value="ACTIVE_PROPOSAL">Active proposal</option>
                </select>
                <input
                  name="category"
                  defaultValue={params?.category ?? ""}
                  placeholder="Category"
                  className="h-11 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                />
                <button
                  type="submit"
                  className="h-11 rounded-md bg-emerald-500 px-3 text-sm font-medium text-slate-950 hover:bg-emerald-400"
                >
                  Apply
                </button>
              </div>
            </form>

            {marketsError ? (
              <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 p-4 text-sm text-rose-100">
                {marketsError}
              </div>
            ) : null}
            <AdminMarketsTable markets={marketsResult.markets} totalCount={marketsResult.totalCount} />

            {marketHasMore ? (
              <div>
                <Link
                  href={`/admin?${nextMarketParams.toString()}`}
                  className="inline-flex h-10 items-center rounded-md border border-slate-700 bg-slate-900/70 px-4 text-sm font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-800/70"
                >
                  Load more markets
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "users" ? (
          <div className="space-y-4">
            <form className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
              <input type="hidden" name="tab" value="users" />
              <input type="hidden" name="user_count" value={String(USER_PAGE_SIZE)} />
              <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.5fr]">
                <input
                  name="user_search"
                  defaultValue={params?.user_search ?? ""}
                  placeholder="Search name, username, or id"
                  className="h-11 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                />
                <select
                  name="role"
                  defaultValue={params?.role ?? "ALL"}
                  className="h-11 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                >
                  <option value="ALL">All roles</option>
                  <option value="ADMIN">Admins</option>
                  <option value="NON_ADMIN">Non-admins</option>
                </select>
                <select
                  name="state"
                  defaultValue={params?.state ?? "ALL"}
                  className="h-11 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                >
                  <option value="ALL">All states</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
                <select
                  name="activity"
                  defaultValue={params?.activity ?? "ALL"}
                  className="h-11 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                >
                  <option value="ALL">All activity</option>
                  <option value="RECENT_7D">Recent 7d</option>
                  <option value="RECENT_30D">Recent 30d</option>
                  <option value="NO_TRADES">No trades</option>
                </select>
                <button
                  type="submit"
                  className="h-11 rounded-md bg-emerald-500 px-3 text-sm font-medium text-slate-950 hover:bg-emerald-400"
                >
                  Apply
                </button>
              </div>
            </form>

            {usersError ? (
              <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 p-4 text-sm text-rose-100">
                {usersError}
              </div>
            ) : null}
            <AdminUsersTable users={usersResult.users} totalCount={usersResult.totalCount} />

            {userHasMore ? (
              <div>
                <Link
                  href={`/admin?${nextUserParams.toString()}`}
                  className="inline-flex h-10 items-center rounded-md border border-slate-700 bg-slate-900/70 px-4 text-sm font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-800/70"
                >
                  Load more users
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "disputes" ? (
          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5">
              <h2 className="text-xl font-semibold text-slate-100">Dispute queue</h2>
              <p className="mt-1 text-sm text-slate-400">
                Review challenged proposals, inspect urgency, and settle markets with clear notes.
              </p>
            </div>

            {disputesError ? (
              <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 p-4 text-sm text-rose-100">
                {disputesError}
              </div>
            ) : null}

            {disputeRows.map(({ dispute, market }) => (
              <article key={dispute.id} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-100">{market?.title ?? dispute.market_id}</h3>
                    <p className="mt-1 text-sm text-slate-300">
                      Proposal outcome: {dispute.proposed_outcome} · Challenge kind: {dispute.challenge_kind.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      Submitted {formatDateTime(dispute.created_at)} · Challenge deadline {formatDateTime(dispute.challenge_deadline)} · {countdownTo(dispute.challenge_deadline)}
                    </p>
                  </div>
                  <Link href={`/markets/${dispute.market_id}`} className="text-sm text-emerald-300 hover:text-emerald-200">
                    Open market detail
                  </Link>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-400">
                  {dispute.challenge_label}
                </div>

                <AdminControls marketId={dispute.market_id} />
              </article>
            ))}

            {disputeRows.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 text-slate-400">
                No challenged disputes.
              </div>
            ) : null}
          </section>
        ) : null}
      </section>
    </main>
  );
}
