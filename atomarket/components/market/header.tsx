import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AuthCTAButtons } from "@/components/market/auth-cta-buttons";
import { LogoutButton } from "@/components/logout-button";
import { formatNeutrons } from "@/lib/domain/format";
import atoMarketLogo from "@/app/AtoMarket Logo 512 Transparent.png";

const navItems = [
  { href: "/markets", label: "Markets" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/markets/new", label: "Create" },
];

export async function MarketHeader({ includeViewer = true }: { includeViewer?: boolean }) {
  const [user, profile] = includeViewer
    ? await (async () => {
        const supabase = await createClient();
        const { data } = await supabase.auth.getUser();
        const currentUser = data.user;
        const currentProfile = currentUser
          ? await supabase
              .from("profiles")
              .select("display_name, neutron_balance, is_admin")
              .eq("id", currentUser.id)
              .single()
              .then((res) => res.data)
          : null;
        return [currentUser, currentProfile] as const;
      })()
    : [null, null];

  return (
    <header className="sticky top-0 z-30 border-b border-emerald-500/20 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0 flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-emerald-300">
            <Image
              src={atoMarketLogo}
              alt="AtoMarket logo"
              width={28}
              height={28}
              className="h-7 w-7"
              priority
            />
            <span>AtoMarket</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-2 py-1 transition hover:bg-slate-800 hover:text-emerald-200"
              >
                {item.label}
              </Link>
            ))}
            {profile?.is_admin ? (
              <Link
                href="/admin"
                className="rounded-md px-2 py-1 transition hover:bg-slate-800 hover:text-emerald-200"
              >
                Admin
              </Link>
            ) : null}
          </nav>
        </div>

        {user ? (
          <div className="min-w-0 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-md border border-emerald-400/35 bg-emerald-500/10 px-2 py-1 text-emerald-200">
              {formatNeutrons(profile?.neutron_balance ?? 0)} neutrons
            </span>
            <Link
              href="/profile"
              className="block max-w-40 truncate rounded-md px-2 py-1 text-slate-300 transition hover:bg-slate-800 hover:text-emerald-200"
            >
              {profile?.display_name || user.email}
            </Link>
            <LogoutButton />
          </div>
        ) : (
          <AuthCTAButtons />
        )}
      </div>
    </header>
  );
}
