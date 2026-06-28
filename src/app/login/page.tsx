import { redirect } from "next/navigation";
import { BookOpenCheck } from "lucide-react";

import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user?.id) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-6">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-zinc-200 bg-white md:grid-cols-[1.1fr_0.9fr]">
        <div className="p-8 md:p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-700 text-white">
              <BookOpenCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                EasySLR assignment
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">Article Review Workspace</h1>
            </div>
          </div>
          <p className="mt-6 max-w-xl text-sm leading-6 text-zinc-600">
            Sign in with the seeded reviewer account to import PubMed-style Excel exports, review
            articles by project, and verify that project access is enforced on the server.
          </p>
          <div className="mt-8 grid gap-3 text-sm sm:grid-cols-3">
            <Capability label="Scoped access" />
            <Capability label="Excel validation" />
            <Capability label="Review workflow" />
          </div>
        </div>
        <div className="border-t border-zinc-200 bg-zinc-50 p-8 md:border-l md:border-t-0 md:p-10">
          <div className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
            <div className="font-semibold">Demo credentials</div>
            <p className="mt-1 text-emerald-800">
              Use this account for now to review the assignment locally.
            </p>
            <dl className="mt-3 space-y-1">
              <div className="flex justify-between gap-3">
                <dt className="text-emerald-700">Email</dt>
                <dd className="font-medium">sourav@example.com</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-emerald-700">Password</dt>
                <dd className="font-medium">Password123!</dd>
              </div>
            </dl>
          </div>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}

function Capability({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-medium text-zinc-700">
      {label}
    </div>
  );
}
