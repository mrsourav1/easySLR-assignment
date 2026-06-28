"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";

import { importArticles, type ActionState } from "@/app/actions";

const initialState: ActionState = {
  ok: false,
  message: "",
};

export function ImportArticlesForm({ projectId }: { projectId: string }) {
  const [state, action, isPending] = useActionState(importArticles, initialState);

  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input
        type="file"
        name="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700"
        required
      />
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
      >
        <Upload className="h-4 w-4" />
        {isPending ? "Importing..." : "Import Excel"}
      </button>
      {state.message ? (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            state.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <div>{state.message}</div>
          {state.details?.length ? (
            <div className="mt-1 text-xs opacity-80">{state.details.join(" · ")}</div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
