import { redirect } from "next/navigation";
import { MarketHeader } from "@/components/market/header";
import { CreateMarketForm } from "@/components/market/create-market-form";
import { getViewer } from "@/lib/actions/query";

export const dynamic = "force-dynamic";

export default async function NewMarketPage() {
  const user = await getViewer();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <main>
      <MarketHeader />
      <section className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-semibold text-slate-100">Create Market</h1>
        <p className="mb-6 text-sm text-slate-400">
          Strict template validation is enforced. Use clear wording and verifiable resolution rules.
        </p>
        <CreateMarketForm />
      </section>
    </main>
  );
}
