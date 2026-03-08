import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use | AtoMarket",
  description: "Terms of use for AtoMarket.",
};

const effectiveDate = "March 8, 2026";
const contactEmail = "atomarket@atomic-blender.com";

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-14">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/75 p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Terms of Use</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100">Terms of Use</h1>
        <p className="mt-3 text-sm text-slate-400">Effective date: {effectiveDate}</p>
        <p className="mt-6 text-sm leading-7 text-slate-300">
          By accessing or using AtoMarket, you agree to these terms. If you do not agree, do not use the service.
        </p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-slate-300">
          <section>
            <h2 className="text-base font-semibold text-slate-100">Informational simulation only</h2>
            <p className="mt-2">
              AtoMarket is provided for informational and simulation purposes only. It does not involve real money,
              gambling, securities trading, commodity trading, or legally binding contracts or financial instruments.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-100">No advice or reliance</h2>
            <p className="mt-2">
              Content, prices, rankings, probabilities, and market outcomes on AtoMarket are not financial, legal,
              investment, operational, technical, or professional advice. You must not rely on the service for
              decisions involving money, safety, compliance, business operations, forecasting, or any real-world action.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-100">No warranties</h2>
            <p className="mt-2">
              The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis. We do not guarantee accuracy,
              completeness, availability, timeliness, fitness for a particular purpose, or uninterrupted operation.
              Markets, scores, and related information may be incomplete, delayed, inaccurate, changed, or removed.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-100">Limitation of liability</h2>
            <p className="mt-2">
              To the maximum extent permitted by law, AtomicBlender LLC is not liable for any direct, indirect,
              incidental, consequential, special, exemplary, or other damages arising from or related to your use of,
              inability to use, or reliance on AtoMarket. You use the service at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-100">Acceptable use</h2>
            <p className="mt-2">
              You may not use the service for unlawful activity, impersonation, abuse, interference with other users,
              attempts to gain unauthorized access, security testing without permission, or abusive scraping or
              automation that disrupts the product.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-100">Service changes and accounts</h2>
            <p className="mt-2">
              We may suspend or terminate access, modify features, remove content, or discontinue the service at any
              time, with or without notice. We may also take action to protect the platform, other users, or market
              integrity.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-100">Changes to these terms</h2>
            <p className="mt-2">
              We may update or modify these terms at any time by posting a revised version on the site. Changes become
              effective when posted unless we state otherwise. Your continued use of AtoMarket after updated terms are
              posted means you accept the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-100">Contact</h2>
            <p className="mt-2">
              Questions about these terms can be sent to{" "}
              <Link href={`mailto:${contactEmail}`} className="text-emerald-300 hover:text-emerald-200">
                {contactEmail}
              </Link>
              .
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
