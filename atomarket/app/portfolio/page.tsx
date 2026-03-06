import { redirect } from "next/navigation";
import Link from "next/link";
import { MarketHeader } from "@/components/market/header";
import { PortfolioView } from "@/components/portfolio/portfolio-view";
import { getPortfolio, getProfile, getViewer } from "@/lib/actions/query";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const user = await getViewer();
  if (!user) {
    redirect("/auth/login?next=/portfolio");
  }

  const [profile, portfolio] = await Promise.all([getProfile(user.id), getPortfolio(user.id)]);

  return (
    <main>
      <MarketHeader />
      <PortfolioView
        title="Portfolio"
        subtitle={
          profile?.username ? (
            <>
              Public profile:{" "}
              <Link href={`/u/${profile.username}`} className="text-emerald-300 hover:text-emerald-200 hover:underline">
                /u/{profile.username}
              </Link>
            </>
          ) : (
            "Set a username in Profile to enable your public URL."
          )
        }
        positions={portfolio.positions}
        trades={portfolio.trades}
        balance={profile?.neutron_balance ?? 0}
      />
    </main>
  );
}
