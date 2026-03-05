"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = {
  ok: boolean;
  message: string;
};

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

export async function updateDisplayNameAction(formData: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return { ok: false, message: "Sign in required." };
    }

    const displayName = String(formData.get("display_name") ?? "").trim();
    const nextDisplayName = displayName.length > 0 ? displayName : null;

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: nextDisplayName })
      .eq("id", authData.user.id);

    if (error) {
      return { ok: false, message: error.message };
    }

    revalidatePath("/profile");
    revalidatePath("/");
    revalidatePath("/markets");

    return { ok: true, message: "Username updated." };
  } catch (error) {
    return { ok: false, message: asMessage(error) };
  }
}

export async function changePasswordAction(formData: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return { ok: false, message: "Sign in required." };
    }

    const newPassword = String(formData.get("new_password") ?? "");
    const confirmPassword = String(formData.get("confirm_password") ?? "");

    if (newPassword.length < 8) {
      return { ok: false, message: "Password must be at least 8 characters." };
    }

    if (newPassword !== confirmPassword) {
      return { ok: false, message: "Password confirmation does not match." };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      return { ok: false, message: error.message };
    }

    return { ok: true, message: "Password updated." };
  } catch (error) {
    return { ok: false, message: asMessage(error) };
  }
}

export async function deactivateAccountAction(): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return { ok: false, message: "Sign in required." };
    }

    const { error } = await supabase
      .from("profiles")
      .update({ is_active: false, deactivated_at: new Date().toISOString() })
      .eq("id", authData.user.id);

    if (error) {
      return { ok: false, message: error.message };
    }

    await supabase.auth.signOut();

    revalidatePath("/");
    revalidatePath("/profile");
    revalidatePath("/markets");

    return {
      ok: true,
      message:
        "Account deactivated. Existing markets, trades, and positions are preserved for market integrity.",
    };
  } catch (error) {
    return { ok: false, message: asMessage(error) };
  }
}
