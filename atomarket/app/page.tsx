import Link from "next/link";
import { MarketHeader } from "@/components/market/header";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main>
      <MarketHeader />
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm uppercase tracking-[0.2em] text-emerald-300">AtoMarket MVP</p>
          <h1 className="text-4xl font-semibold leading-tight text-slate-100 md:text-6xl">
            Trade binary predictions with neutrons.
          </h1>
          <p className="mt-5 text-lg text-slate-300">
            AtoMarket is a lightweight prediction market focused on verifiable YES/NO outcomes with transparent resolution rules.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">
              <Link href="/markets">Browse Markets</Link>
            </Button>
            <Button asChild variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-900">
              <Link href="/markets/new">Create Market</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
