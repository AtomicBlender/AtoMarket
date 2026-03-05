"use client";

import { useState } from "react";
import { createMarketAction } from "@/lib/actions/market";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateMarketForm() {
  const [message, setMessage] = useState<string>("");
  const [pending, setPending] = useState(false);

  async function onAction(formData: FormData) {
    setPending(true);
    const result = await createMarketAction(formData);
    setMessage(result.message ?? "");
    setPending(false);
  }

  return (
    <form action={onAction} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="grid gap-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required className="border-slate-700 bg-slate-950 text-slate-100" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="question">Question</Label>
        <Input id="question" name="question" required className="border-slate-700 bg-slate-950 text-slate-100" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="category">Category</Label>
        <Input id="category" name="category" className="border-slate-700 bg-slate-950 text-slate-100" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="close_time">Close Time (UTC)</Label>
          <Input id="close_time" name="close_time" type="datetime-local" required className="border-slate-700 bg-slate-950 text-slate-100" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="resolution_deadline">Resolution Deadline (UTC)</Label>
          <Input id="resolution_deadline" name="resolution_deadline" type="datetime-local" required className="border-slate-700 bg-slate-950 text-slate-100" />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="resolution_type">Resolution Type</Label>
        <select
          id="resolution_type"
          name="resolution_type"
          defaultValue="URL_SELECTOR"
          className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
        >
          <option value="URL_SELECTOR">URL_SELECTOR</option>
          <option value="JSON_PATH">JSON_PATH</option>
          <option value="MANUAL_WITH_BOND">MANUAL_WITH_BOND</option>
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="resolution_source">Resolution Source</Label>
        <Input id="resolution_source" name="resolution_source" required className="border-slate-700 bg-slate-950 text-slate-100" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="resolution_url">Resolution URL (optional for MANUAL_WITH_BOND)</Label>
        <Input id="resolution_url" name="resolution_url" className="border-slate-700 bg-slate-950 text-slate-100" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="resolution_rule">Resolution Rule JSON</Label>
        <textarea
          id="resolution_rule"
          name="resolution_rule"
          rows={6}
          required
          defaultValue='{"selector":"body","operator":"contains","compare_value":"example"}'
          className="rounded-md border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="challenge_window_hours">Challenge Window Hours</Label>
          <Input id="challenge_window_hours" name="challenge_window_hours" type="number" defaultValue={48} className="border-slate-700 bg-slate-950 text-slate-100" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="proposal_bond_neutrons">Proposal Bond (Neutrons)</Label>
          <Input id="proposal_bond_neutrons" name="proposal_bond_neutrons" type="number" defaultValue={500} className="border-slate-700 bg-slate-950 text-slate-100" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="challenge_bond_neutrons">Challenge Bond (Neutrons)</Label>
          <Input id="challenge_bond_neutrons" name="challenge_bond_neutrons" type="number" defaultValue={500} className="border-slate-700 bg-slate-950 text-slate-100" />
        </div>
      </div>

      <Button disabled={pending} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">
        {pending ? "Creating..." : "Create Market"}
      </Button>

      {message ? <p className="text-sm text-slate-300">{message}</p> : null}
    </form>
  );
}
