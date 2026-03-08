import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | AtoMarket",
  description: "Privacy information for AtoMarket.",
};

const effectiveDate = "March 8, 2026";
const contactEmail = "atomarket@atomic-blender.com";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-14">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/75 p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Privacy Policy</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100">Privacy</h1>
        <p className="mt-3 text-sm text-slate-400">Effective date: {effectiveDate}</p>
        <p className="mt-6 text-sm leading-7 text-slate-300">
          AtoMarket is an informational simulation product operated by AtomicBlender LLC. We collect the minimum
          personal information needed to operate accounts and keep the service functioning.
        </p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-slate-300">
          <section>
            <h2 className="text-base font-semibold text-slate-100">What we collect</h2>
            <p className="mt-2">
              We use email and password-based account authentication through Supabase. Your email address is the main
              personal information we collect to create, secure, and distinguish your account.
            </p>
            <p className="mt-2">
              The service also generates a display name and username from your email address so your account can appear
              in the product. Market activity, portfolio information, rankings, and other profile-related activity may
              be visible to other users or publicly accessible pages of the site.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-100">How we use information</h2>
            <p className="mt-2">
              We use account information only to operate the service, authenticate users, maintain account integrity,
              support basic administration, and help secure the platform. We do not sell personal information, and we
              do not use your email address for unrelated marketing purposes based on the current product.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-100">Public visibility</h2>
            <p className="mt-2">
              Because the product includes public-facing market and profile features, information connected to your
              account activity may be shown to others. Do not submit sensitive information you do not want displayed,
              retained, or associated with your account.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-100">Retention and changes</h2>
            <p className="mt-2">
              We may retain account and activity data as needed to operate the service, preserve market integrity, meet
              security needs, and maintain internal records. We may update this policy from time to time by posting a
              revised version on this page.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-100">Contact</h2>
            <p className="mt-2">
              Privacy questions can be sent to{" "}
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
