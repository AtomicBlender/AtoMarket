"use client";

import { useMemo, useState } from "react";
import { createMarketAction } from "@/lib/actions/market";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ResolutionType = "URL_SELECTOR" | "JSON_PATH" | "MANUAL_WITH_BOND";

const defaultRules: Record<ResolutionType, string> = {
  URL_SELECTOR: '{\n  "selector": "body",\n  "operator": "contains",\n  "compare_value": "example"\n}',
  JSON_PATH: '{\n  "json_path": "$.data.status",\n  "operator": "equals",\n  "compare_value": "approved"\n}',
  MANUAL_WITH_BOND: '{\n  "evidence_requirements": "Link official source and explain the decisive statement."\n}',
};

const helperText: Record<ResolutionType, { title: string; body: string }> = {
  URL_SELECTOR: {
    title: "URL selector market",
    body: "Use a stable public page plus selector/operator fields to auto-resolve.",
  },
  JSON_PATH: {
    title: "JSON path market",
    body: "Use an API endpoint and json_path/operator fields to auto-resolve.",
  },
  MANUAL_WITH_BOND: {
    title: "Manual with bond",
    body: "Resolution is proposed with evidence and can be challenged during the window.",
  },
};

export function CreateMarketForm() {
  const [message, setMessage] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [resolutionType, setResolutionType] = useState<ResolutionType>("URL_SELECTOR");
  const [ruleText, setRuleText] = useState(defaultRules.URL_SELECTOR);

  const helper = useMemo(() => helperText[resolutionType], [resolutionType]);

  async function onAction(formData: FormData) {
    setPending(true);
    const result = await createMarketAction(formData);
    setMessage(result.message ?? "");
    setPending(false);
  }

  return (
    <form action={onAction} className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/75 p-5">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Market Basics</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required className="h-11 border-slate-700 bg-slate-950 text-slate-100" />
            <p className="text-xs text-slate-500">Clear and concise headline shown in market cards.</p>
          </div>

          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="question">Question</Label>
            <Input id="question" name="question" required className="h-11 border-slate-700 bg-slate-950 text-slate-100" />
            <p className="text-xs text-slate-500">Binary YES/NO, unambiguous, and time-bounded.</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="category">Category</Label>
            <Input id="category" name="category" placeholder="Regulation" className="h-11 border-slate-700 bg-slate-950 text-slate-100" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="resolution_source">Resolution Source</Label>
            <Input id="resolution_source" name="resolution_source" required className="h-11 border-slate-700 bg-slate-950 text-slate-100" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Timing</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="close_time">Close Time (UTC)</Label>
            <Input id="close_time" name="close_time" type="datetime-local" required className="h-11 border-slate-700 bg-slate-950 text-slate-100" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="resolution_deadline">Resolution Deadline (UTC)</Label>
            <Input id="resolution_deadline" name="resolution_deadline" type="datetime-local" required className="h-11 border-slate-700 bg-slate-950 text-slate-100" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Resolution Template</h2>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <p className="text-sm font-medium text-slate-100">{helper.title}</p>
          <p className="text-xs text-slate-400">{helper.body}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="resolution_type">Resolution Type</Label>
            <select
              id="resolution_type"
              name="resolution_type"
              value={resolutionType}
              onChange={(event) => {
                const nextType = event.target.value as ResolutionType;
                setResolutionType(nextType);
                setRuleText(defaultRules[nextType]);
              }}
              className="h-11 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="URL_SELECTOR">URL_SELECTOR</option>
              <option value="JSON_PATH">JSON_PATH</option>
              <option value="MANUAL_WITH_BOND">MANUAL_WITH_BOND</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="resolution_url">Resolution URL</Label>
            <Input
              id="resolution_url"
              name="resolution_url"
              placeholder={resolutionType === "MANUAL_WITH_BOND" ? "Optional" : "Required"}
              className="h-11 border-slate-700 bg-slate-950 text-slate-100"
            />
          </div>

          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="resolution_rule">Resolution Rule JSON</Label>
            <textarea
              id="resolution_rule"
              name="resolution_rule"
              rows={7}
              required
              value={ruleText}
              onChange={(event) => setRuleText(event.target.value)}
              className="rounded-md border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Challenge & Bonds</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="challenge_window_hours">Challenge Window Hours</Label>
            <Input
              id="challenge_window_hours"
              name="challenge_window_hours"
              type="number"
              defaultValue={48}
              className="h-11 border-slate-700 bg-slate-950 text-slate-100"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="proposal_bond_neutrons">Proposal Bond (Neutrons)</Label>
            <Input
              id="proposal_bond_neutrons"
              name="proposal_bond_neutrons"
              type="number"
              defaultValue={500}
              className="h-11 border-slate-700 bg-slate-950 text-slate-100"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="challenge_bond_neutrons">Challenge Bond (Neutrons)</Label>
            <Input
              id="challenge_bond_neutrons"
              name="challenge_bond_neutrons"
              type="number"
              defaultValue={500}
              className="h-11 border-slate-700 bg-slate-950 text-slate-100"
            />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-800 pt-4">
        <Button disabled={pending} className="h-11 bg-emerald-500 px-5 text-slate-950 hover:bg-emerald-400">
          {pending ? "Creating market..." : "Create Market"}
        </Button>
        <p className="text-xs text-slate-500">Creation is permissioned to authenticated users and validated against template rules.</p>
      </div>

      {message ? <p className="rounded-md bg-slate-800 p-2 text-sm text-slate-300">{message}</p> : null}
    </form>
  );
}
