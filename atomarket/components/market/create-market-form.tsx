"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMarketAction } from "@/lib/actions/market";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateMarketForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");

  const TITLE_LIMIT = 100;
  const QUESTION_LIMIT = 250;
  const titleTooLong = title.length >= TITLE_LIMIT;
  const questionTooLong = question.length >= QUESTION_LIMIT;
  const hasLengthError = titleTooLong || questionTooLong;

  async function onAction(formData: FormData) {
    if (hasLengthError) {
      setMessage("Title must be under 100 characters and question must be under 250 characters.");
      return;
    }
    setPending(true);
    setMessage("");
    const result = await createMarketAction(formData);
    if (result.ok && result.marketId) {
      router.push(`/markets/${result.marketId}`);
      return;
    }
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
            <Input
              id="title"
              name="title"
              required
              placeholder="Will Utility X announce an SMR pilot site by Aug 31, 2026?"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-11 border-slate-700 bg-slate-950 text-slate-100"
            />
            <p className={`text-xs ${titleTooLong ? "text-rose-300" : "text-slate-500"}`}>
              {title.length}/{TITLE_LIMIT} characters {titleTooLong ? "(must be under limit)" : ""}
            </p>
          </div>

          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="question">Question</Label>
            <Input
              id="question"
              name="question"
              required
              placeholder="Will Utility X publish a signed SMR pilot agreement by Aug 31, 2026?"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className="h-11 border-slate-700 bg-slate-950 text-slate-100"
            />
            <p className={`text-xs ${questionTooLong ? "text-rose-300" : "text-slate-500"}`}>
              Use clear YES/NO wording with a specific deadline. {question.length}/{QUESTION_LIMIT} characters{" "}
              {questionTooLong ? "(must be under limit)" : ""}
            </p>
          </div>

          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Add context: what event is being tracked, how users should interpret the question, and any key assumptions."
              className="rounded-md border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100"
            />
            <p className="text-xs text-slate-500">Optional details to help traders understand the market context.</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              name="category"
              placeholder="Regulation"
              className="h-11 border-slate-700 bg-slate-950 text-slate-100"
            />
          </div>

        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Timing</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="close_time">Close Time (UTC)</Label>
            <Input
              id="close_time"
              name="close_time"
              type="datetime-local"
              required
              className="h-11 border-slate-700 bg-slate-950 text-slate-100"
            />
            <p className="text-xs text-slate-500">
              Trading stops at this time. Pick a moment just before the outcome can be confidently known.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="resolution_deadline">Resolution Deadline (UTC)</Label>
            <Input
              id="resolution_deadline"
              name="resolution_deadline"
              type="datetime-local"
              required
              className="h-11 border-slate-700 bg-slate-950 text-slate-100"
            />
            <p className="text-xs text-slate-500">
              Final time to resolve. If unresolved by this deadline, the market may be invalidated and refunded.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Resolution Setup</h2>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-sm font-medium text-slate-100">Submit Public Evidence with Bond</p>
          <p className="mb-3 mt-1 text-xs text-slate-400">
            Proposals can be submitted any time before the resolution deadline. Define clear evidence standards below.
          </p>

          <div className="mb-4 grid gap-2">
            <Label htmlFor="resolution_source">Resolution Source</Label>
            <textarea
              id="resolution_source"
              name="resolution_source"
              rows={2}
              required
              placeholder="Example: NRC public docket + company press releases + SEC filings"
              className="rounded-md border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100"
            />
            <p className="text-xs text-slate-500">
              List the sources resolvers should use. Be specific so evidence can be verified consistently.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="evidence_requirements">Evidence Requirements</Label>
            <textarea
              id="evidence_requirements"
              name="evidence_requirements"
              rows={4}
              placeholder="Example: Include official announcement URL and the exact sentence proving the outcome."
              className="rounded-md border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100"
            />
            <p className="text-xs text-slate-500">
              Define what counts as valid proof so proposers and challengers follow the same standard, regardless of
              when the evidence was published.
            </p>
          </div>
        </div>

        <input type="hidden" name="resolution_type" value="MANUAL_WITH_BOND" />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Challenge & Bonds</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="challenge_window_hours">Challenge Window (Hours)</Label>
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
        <Button disabled={pending || hasLengthError} className="h-11 bg-emerald-500 px-5 text-slate-950 hover:bg-emerald-400">
          {pending ? "Creating market..." : "Create Market"}
        </Button>
        <p className="text-xs text-slate-500">Tip: Use explicit deadlines and source expectations to avoid disputes.</p>
      </div>

      {message ? <p className="rounded-md bg-slate-800 p-2 text-sm text-slate-300">{message}</p> : null}
    </form>
  );
}
