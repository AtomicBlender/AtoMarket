"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

function buildNextPath(pathname: string, searchParams: URLSearchParams): string {
  const qs = searchParams.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function AuthCTAButtons() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nextPath = buildNextPath(pathname, searchParams);

  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="outline" size="sm" className="border-emerald-400/40 text-emerald-200">
        <Link href={`/auth/login?next=${encodeURIComponent(nextPath)}`}>Sign in</Link>
      </Button>
      <Button asChild size="sm" className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">
        <Link href="/auth/sign-up">Sign up</Link>
      </Button>
    </div>
  );
}
