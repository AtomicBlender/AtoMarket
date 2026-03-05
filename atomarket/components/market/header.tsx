import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/logout-button";

export async function MarketHeader() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  return (
    <header className="sticky top-0 z-20 border-b border-emerald-500/20 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold tracking-tight text-emerald-300">
            AtoMarket
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-300">
            <Link href="/markets" className="hover:text-emerald-200">
              Markets
            </Link>
            <Link href="/portfolio" className="hover:text-emerald-200">
              Portfolio
            </Link>
            <Link href="/markets/new" className="hover:text-emerald-200">
              Create
            </Link>
            <Link href="/admin" className="hover:text-emerald-200">
              Admin
            </Link>
          </nav>
        </div>

        {user ? (
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <span>{user.email}</span>
            <LogoutButton />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="border-emerald-400/40 text-emerald-200">
              <Link href="/auth/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">
              <Link href="/auth/sign-up">Sign up</Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
