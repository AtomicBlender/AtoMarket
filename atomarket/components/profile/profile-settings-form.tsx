"use client";

import { useState } from "react";
import {
  changePasswordAction,
  deactivateAccountAction,
  updateDisplayNameAction,
} from "@/lib/actions/profile";
import type { Profile } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileSettingsForm({
  email,
  profile,
}: {
  email: string;
  profile: Profile | null;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [deactivateEmailInput, setDeactivateEmailInput] = useState("");

  async function runAction(action: (formData: FormData) => Promise<{ ok: boolean; message: string }>, formData: FormData) {
    setPending(true);
    setMessage("");
    setError("");
    const result = await action(formData);
    if (result.ok) {
      setMessage(result.message);
    } else {
      setError(result.message);
    }
    setPending(false);
  }

  async function onDisplayNameAction(formData: FormData) {
    await runAction(updateDisplayNameAction, formData);
  }

  async function onPasswordAction(formData: FormData) {
    await runAction(changePasswordAction, formData);
  }

  async function onDeactivateAction() {
    setPending(true);
    setMessage("");
    setError("");
    const result = await deactivateAccountAction();
    if (result.ok) {
      setMessage(result.message);
      window.location.href = "/auth/login";
    } else {
      setError(result.message);
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Account</h2>
        <div className="mt-3 grid gap-2 text-sm text-slate-300">
          <div>
            <span className="text-slate-500">Email</span>
            <p className="mt-1 text-slate-100">{email}</p>
          </div>

          <div>
            <span className="text-slate-500">Status</span>
            <p className="mt-1 text-slate-200">{profile?.is_active === false ? "Inactive" : "Active"}</p>
          </div>
        </div>
      </section>

      <form action={onDisplayNameAction} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Profile</h2>
        <div className="grid gap-2">
          <Label htmlFor="display_name">Username</Label>
          <Input
            id="display_name"
            name="display_name"
            defaultValue={profile?.display_name ?? ""}
            placeholder="Set a username"
            className="h-11 border-slate-700 bg-slate-950 text-slate-100"
          />
        </div>
        <Button disabled={pending} className="h-10 bg-emerald-500 text-slate-950 hover:bg-emerald-400">
          Save Username
        </Button>
      </form>

      <form action={onPasswordAction} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Security</h2>
        <div className="grid gap-2">
          <Label htmlFor="new_password">New password</Label>
          <Input
            id="new_password"
            name="new_password"
            type="password"
            minLength={8}
            required
            className="h-11 border-slate-700 bg-slate-950 text-slate-100"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirm_password">Confirm new password</Label>
          <Input
            id="confirm_password"
            name="confirm_password"
            type="password"
            minLength={8}
            required
            className="h-11 border-slate-700 bg-slate-950 text-slate-100"
          />
        </div>
        <Button disabled={pending} className="h-10 bg-emerald-500 text-slate-950 hover:bg-emerald-400">
          Update Password
        </Button>
      </form>

      <section className="space-y-3 rounded-2xl border border-rose-500/35 bg-rose-500/5 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-300">Deactivate account</h2>
        <p className="text-sm text-slate-300">
          This deactivates your account. You will be signed out after confirmation.
        </p>
        <Button
          type="button"
          onClick={() => {
            setDeactivateEmailInput("");
            setShowDeactivateDialog(true);
          }}
          className="h-10 bg-rose-500 text-white hover:bg-rose-400"
        >
          Deactivate account
        </Button>
      </section>

      {showDeactivateDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100">Confirm account deactivation</h3>
            <p className="text-sm text-slate-300">
              Type your email address to confirm: <span className="font-medium text-slate-100">{email}</span>
            </p>
            <Input
              value={deactivateEmailInput}
              onChange={(event) => setDeactivateEmailInput(event.target.value)}
              placeholder="you@example.com"
              className="h-11 border-slate-700 bg-slate-950 text-slate-100"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={onDeactivateAction}
                disabled={pending || deactivateEmailInput.trim().toLowerCase() !== email.toLowerCase()}
                className="h-10 bg-rose-500 text-white hover:bg-rose-400"
              >
                {pending ? "Deactivating..." : "Confirm deactivation"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                onClick={() => setShowDeactivateDialog(false)}
                disabled={pending}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {message ? <p className="rounded-md bg-emerald-500/10 p-2 text-sm text-emerald-200">{message}</p> : null}
      {error ? <p className="rounded-md bg-rose-500/10 p-2 text-sm text-rose-200">{error}</p> : null}
    </div>
  );
}
