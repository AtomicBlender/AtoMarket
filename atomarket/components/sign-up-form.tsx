"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { validateUsername } from "@/lib/domain/validation";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [usernameAvailability, setUsernameAvailability] = useState<"unknown" | "checking" | "available" | "taken">(
    "unknown",
  );
  const router = useRouter();

  async function checkUsernameAvailability(nextUsername: string) {
    const supabase = createClient();
    const normalized = nextUsername.trim().toLowerCase();
    if (!normalized) {
      setUsernameAvailability("unknown");
      return;
    }
    setUsernameAvailability("checking");
    const { data, error } = await supabase.rpc("is_username_available", {
      p_username: normalized,
    });
    if (error) {
      setUsernameAvailability("unknown");
      return;
    }
    setUsernameAvailability(data ? "available" : "taken");
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    let normalizedUsername = "";
    try {
      normalizedUsername = validateUsername(username);
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "Invalid username");
      setIsLoading(false);
      return;
    }

    const { data: isAvailable, error: availabilityError } = await supabase.rpc("is_username_available", {
      p_username: normalizedUsername,
    });
    if (availabilityError || !isAvailable) {
      setError("That username is already taken.");
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: normalizedUsername,
          },
          emailRedirectTo: `${window.location.origin}/markets`,
        },
      });
      if (error) throw error;
      router.push("/auth/sign-up-success");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Sign up</CardTitle>
          <CardDescription>Create a new account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="your_handle"
                  required
                  value={username}
                  onChange={(e) => {
                    const nextUsername = e.target.value;
                    setUsername(nextUsername);
                    void checkUsernameAvailability(nextUsername);
                  }}
                />
                <p className="text-xs text-slate-500">3-24 chars: lowercase letters, numbers, underscores.</p>
                {usernameAvailability === "checking" ? <p className="text-xs text-slate-400">Checking username...</p> : null}
                {usernameAvailability === "available" ? <p className="text-xs text-emerald-300">Username is available.</p> : null}
                {usernameAvailability === "taken" ? <p className="text-xs text-rose-300">Username is taken.</p> : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="repeat-password">Repeat Password</Label>
                </div>
                <Input
                  id="repeat-password"
                  type="password"
                  required
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading || usernameAvailability === "taken"}>
                {isLoading ? "Creating an account..." : "Sign up"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <Link href="/auth/login" className="underline underline-offset-4">
                Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
