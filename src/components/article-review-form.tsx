"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";

import { updateArticleReview, type ActionState } from "@/app/actions";

const initialState: ActionState = {
  ok: false,
  message: "",
};

const statuses = [
  { value: "UNREVIEWED", label: "Unreviewed" },
  { value: "INCLUDE", label: "Include" },
  { value: "EXCLUDE", label: "Exclude" },
  { value: "MAYBE", label: "Maybe" },
] as const;

export function ArticleReviewForm({
  article,
}: {
  article: {
    id: string;
    projectId: string;
    reviewStatus: string;
    priority: number;
    reviewerNotes: string | null;
    labels: string[];
  };
}) {
  const [state, action, isPending] = useActionState(updateArticleReview, initialState);

  return (
    <form action={action} className="w-[320px] space-y-3">
      <input type="hidden" name="articleId" value={article.id} />
      <input type="hidden" name="projectId" value={article.projectId} />
      <div className="grid grid-cols-[1fr_92px] gap-2">
        <select
          name="reviewStatus"
          defaultValue={article.reviewStatus}
          className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        >
          {statuses.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
        <select
          name="priority"
          defaultValue={article.priority}
          className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          aria-label="Priority"
        >
          <option value="1">P1</option>
          <option value="2">P2</option>
          <option value="3">P3</option>
        </select>
      </div>
      <input
        name="labels"
        defaultValue={article.labels.join(", ")}
        placeholder="Labels, comma separated"
        className="w-full rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      />
      <textarea
        name="reviewerNotes"
        defaultValue={article.reviewerNotes ?? ""}
        placeholder="Reviewer notes"
        rows={3}
        className="w-full resize-y rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      />
      <div className="flex items-center justify-between gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          <Save className="h-4 w-4" />
          {isPending ? "Saving..." : "Save"}
        </button>
        {state.message ? (
          <span className={`text-xs ${state.ok ? "text-emerald-700" : "text-red-700"}`}>
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
