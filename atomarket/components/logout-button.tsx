"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/markets");
  };

  return (
    <Button
      size="sm"
      variant="outline"
      className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
      onClick={logout}
    >
      Logout
    </Button>
  );
}
