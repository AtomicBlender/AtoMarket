import { redirect } from "next/navigation";
import { MarketHeader } from "@/components/market/header";
import { ProfileSettingsForm } from "@/components/profile/profile-settings-form";
import { getProfile, getViewer } from "@/lib/actions/query";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getViewer();

  if (!user) {
    redirect("/auth/login?next=/profile");
  }

  const profile = await getProfile(user.id);

  return (
    <main>
      <MarketHeader />
      <section className="mx-auto max-w-4xl space-y-5 px-4 py-8">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Profile</p>
          <h1 className="mt-2 break-words text-2xl font-semibold text-slate-100 [overflow-wrap:anywhere]">
            Account settings
          </h1>
          <p className="break-words text-sm text-slate-400 [overflow-wrap:anywhere]">
            Manage username, password, and account lifecycle.
          </p>
        </div>

        <ProfileSettingsForm email={user.email ?? "Unknown"} profile={profile} />
      </section>
    </main>
  );
}
