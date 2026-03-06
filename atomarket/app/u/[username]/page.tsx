import { notFound } from "next/navigation";
import { MarketHeader } from "@/components/market/header";
import { PortfolioView } from "@/components/portfolio/portfolio-view";
import { getPublicPortfolioByUsername, getPublicProfileByUsername } from "@/lib/actions/query";

export const revalidate = 90;

interface PublicPortfolioPageProps {
  params: Promise<{ username: string }>;
}

export default async function PublicPortfolioPage({ params }: PublicPortfolioPageProps) {
  const { username } = await params;
  const profile = await getPublicProfileByUsername(username);

  if (!profile) {
    notFound();
  }

  const portfolio = await getPublicPortfolioByUsername(profile.username);
  const displayName = profile.display_name?.trim() || profile.username;

  return (
    <main>
      <MarketHeader includeViewer={false} />
      <PortfolioView
        title={`${displayName}'s Portfolio`}
        subtitle={`@${profile.username}`}
        positions={portfolio.positions}
        trades={portfolio.trades}
      />
    </main>
  );
}
