"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  changePasswordAction,
  deactivateAccountAction,
  updateDisplayNameAction,
  updateUsernameAction,
} from "@/lib/actions/profile";
import Link from "next/link";
import type { Profile } from "@/lib/domain/types";
import { normalizeUsername, validateUsername } from "@/lib/domain/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function ProfileSettingsForm({
  email,
  profile,
}: {
  email: string;
  profile: Profile | null;
}) {
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [displayNamePending, setDisplayNamePending] = useState(false);
  const [displayNameStatus, setDisplayNameStatus] = useState("");
  const [displayNameError, setDisplayNameError] = useState("");

  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [deactivateEmailInput, setDeactivateEmailInput] = useState("");
  const [deactivatePending, setDeactivatePending] = useState(false);
  const [deactivateError, setDeactivateError] = useState("");

  const [username, setUsername] = useState(profile?.username ?? "");
  const [usernamePending, setUsernamePending] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameAvailability, setUsernameAvailability] = useState<"unknown" | "checking" | "available" | "taken">(
    "unknown",
  );
  const usernameRequestRef = useRef(0);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordPending, setPasswordPending] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const originalDisplayName = profile?.display_name ?? "";
  const normalizedCurrentUsername = normalizeUsername(profile?.username ?? "");
  const normalizedUsername = normalizeUsername(username);
  const usernameChanged = normalizedUsername !== normalizedCurrentUsername;
  const usernameEmpty = normalizedUsername.length === 0;

  const usernameFormatError = useMemo(() => {
    if (!usernameChanged || usernameEmpty) return "";
    try {
      validateUsername(normalizedUsername);
      return "";
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid username.";
    }
  }, [normalizedUsername, usernameChanged, usernameEmpty]);

  const usernameIsValid = usernameFormatError.length === 0 && !usernameEmpty;
  const displayNameChanged = displayName.trim() !== originalDisplayName.trim();
  const passwordTooShort = newPassword.length > 0 && newPassword.length < 8;
  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  useEffect(() => {
    if (!usernameChanged || !usernameIsValid) {
      setUsernameAvailability("unknown");
      return;
    }

    const requestId = ++usernameRequestRef.current;
    setUsernameAvailability("checking");
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("is_username_available", {
        p_username: normalizedUsername,
      });

      if (requestId !== usernameRequestRef.current) return;
      if (error) {
        setUsernameAvailability("unknown");
        return;
      }
      setUsernameAvailability(data ? "available" : "taken");
    }, 500);

    return () => clearTimeout(timer);
  }, [normalizedUsername, usernameChanged, usernameIsValid]);

  async function onDisplayNameSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!displayNameChanged || displayNamePending) return;

    setDisplayNamePending(true);
    setDisplayNameStatus("");
    setDisplayNameError("");

    const formData = new FormData();
    formData.set("display_name", displayName);
    const result = await updateDisplayNameAction(formData);

    if (result.ok) {
      setDisplayNameStatus(result.message);
    } else {
      setDisplayNameError(result.message);
    }
    setDisplayNamePending(false);
  }

  async function onPasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordPending || !newPassword || !confirmPassword || passwordTooShort || passwordMismatch) return;

    setPasswordPending(true);
    setPasswordStatus("");
    setPasswordError("");

    const formData = new FormData();
    formData.set("new_password", newPassword);
    formData.set("confirm_password", confirmPassword);
    const result = await changePasswordAction(formData);

    if (result.ok) {
      setPasswordStatus(result.message);
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setPasswordError(result.message);
    }
    setPasswordPending(false);
  }

  const usernameSaveDisabled =
    usernamePending ||
    !usernameChanged ||
    !usernameIsValid ||
    (usernameChanged && usernameAvailability !== "available");

  async function onUsernameSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (usernameSaveDisabled) return;

    setUsernamePending(true);
    setUsernameStatus("");
    setUsernameError("");

    const formData = new FormData();
    formData.set("username", normalizedUsername);
    const result = await updateUsernameAction(formData);

    if (result.ok) {
      setUsernameStatus(result.message);
    } else {
      setUsernameError(result.message);
    }
    setUsernamePending(false);
  }

  async function onDeactivateAction() {
    setDeactivatePending(true);
    setDeactivateError("");
    const result = await deactivateAccountAction();
    if (result.ok) {
      window.location.href = "/auth/login";
    } else {
      setDeactivateError(result.message);
      setDeactivatePending(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Account</h2>
        <div className="mt-3 grid gap-2 text-sm text-slate-300">
          <div>
            <span className="text-slate-500">Email</span>
            <p className="mt-1 break-words text-slate-100 [overflow-wrap:anywhere]">{email}</p>
          </div>

          <div>
            <span className="text-slate-500">Status</span>
            <p className="mt-1 text-slate-200">{profile?.is_active === false ? "Inactive" : "Active"}</p>
          </div>
          <div>
            <span className="text-slate-500">Public profile</span>
            {profile?.username ? (
              <p className="mt-1 break-words text-slate-100 [overflow-wrap:anywhere]">
                <Link
                  href={`/u/${profile.username}`}
                  className="break-words text-emerald-300 [overflow-wrap:anywhere] hover:text-emerald-200"
                >
                  /u/{profile.username}
                </Link>
              </p>
            ) : (
              <p className="mt-1 text-slate-400">Set a username to enable your public profile URL.</p>
            )}
          </div>
        </div>
      </section>

      <form onSubmit={onDisplayNameSubmit} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Display Name</h2>
        <div className="grid gap-2">
          <Label htmlFor="display_name">Display name</Label>
          <Input
            id="display_name"
            name="display_name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="How you appear in UI"
            className="h-11 border-slate-700 bg-slate-950 text-slate-100"
          />
        </div>
        <Button disabled={displayNamePending || !displayNameChanged} className="h-10 bg-emerald-500 text-slate-950 hover:bg-emerald-400">
          {displayNamePending ? "Saving..." : "Save Display Name"}
        </Button>
        {displayNameStatus ? <p className="rounded-md bg-emerald-500/10 p-2 text-sm text-emerald-200">{displayNameStatus}</p> : null}
        {displayNameError ? <p className="rounded-md bg-rose-500/10 p-2 text-sm text-rose-200">{displayNameError}</p> : null}
      </form>

      <form onSubmit={onUsernameSubmit} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Username</h2>
        <div className="grid gap-2">
          <Label htmlFor="username">Public username</Label>
          <Input
            id="username"
            name="username"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              setUsernameStatus("");
              setUsernameError("");
            }}
            placeholder="your_handle"
            className="h-11 border-slate-700 bg-slate-950 text-slate-100"
            required
          />
          <p className="text-xs text-slate-500">Used in your public profile URL: /u/username</p>
          {usernameFormatError ? <p className="text-xs text-rose-300">{usernameFormatError}</p> : null}
          {usernameAvailability === "checking" ? <p className="text-xs text-slate-400">Checking availability...</p> : null}
          {usernameAvailability === "available" ? <p className="text-xs text-emerald-300">Username is available.</p> : null}
          {usernameAvailability === "taken" ? <p className="text-xs text-rose-300">Username is already taken.</p> : null}
        </div>
        <Button
          disabled={usernameSaveDisabled}
          className="h-10 bg-emerald-500 text-slate-950 hover:bg-emerald-400"
        >
          {usernamePending ? "Saving..." : "Save Username"}
        </Button>
        {usernameStatus ? <p className="rounded-md bg-emerald-500/10 p-2 text-sm text-emerald-200">{usernameStatus}</p> : null}
        {usernameError ? <p className="rounded-md bg-rose-500/10 p-2 text-sm text-rose-200">{usernameError}</p> : null}
      </form>

      <form onSubmit={onPasswordSubmit} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Security</h2>
        <div className="grid gap-2">
          <Label htmlFor="new_password">New password</Label>
          <Input
            id="new_password"
            name="new_password"
            type="password"
            minLength={8}
            required
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value);
              setPasswordStatus("");
              setPasswordError("");
            }}
            className="h-11 border-slate-700 bg-slate-950 text-slate-100"
          />
          <p className="text-xs text-slate-500">Minimum 8 characters.</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirm_password">Confirm new password</Label>
          <Input
            id="confirm_password"
            name="confirm_password"
            type="password"
            minLength={8}
            required
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setPasswordStatus("");
              setPasswordError("");
            }}
            className="h-11 border-slate-700 bg-slate-950 text-slate-100"
          />
        </div>
        {passwordTooShort ? <p className="text-xs text-rose-300">Password must be at least 8 characters.</p> : null}
        {passwordMismatch ? <p className="text-xs text-rose-300">Password confirmation does not match.</p> : null}
        <Button
          disabled={passwordPending || !newPassword || !confirmPassword || passwordTooShort || passwordMismatch}
          className="h-10 bg-emerald-500 text-slate-950 hover:bg-emerald-400"
        >
          {passwordPending ? "Updating..." : "Update Password"}
        </Button>
        {passwordStatus ? <p className="rounded-md bg-emerald-500/10 p-2 text-sm text-emerald-200">{passwordStatus}</p> : null}
        {passwordError ? <p className="rounded-md bg-rose-500/10 p-2 text-sm text-rose-200">{passwordError}</p> : null}
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
                disabled={deactivatePending || deactivateEmailInput.trim().toLowerCase() !== email.toLowerCase()}
                className="h-10 bg-rose-500 text-white hover:bg-rose-400"
              >
                {deactivatePending ? "Deactivating..." : "Confirm deactivation"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                onClick={() => setShowDeactivateDialog(false)}
                disabled={deactivatePending}
              >
                Cancel
              </Button>
            </div>
            {deactivateError ? <p className="rounded-md bg-rose-500/10 p-2 text-sm text-rose-200">{deactivateError}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
