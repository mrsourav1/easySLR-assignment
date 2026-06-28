import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, FileSpreadsheet, FolderKanban, LogIn } from "lucide-react";

import { SignOutButton } from "@/components/sign-out-button";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user?.id) {
    redirect("/login");
  }

  const organizations = await prisma.organization.findMany({
    where: {
      members: {
        some: { userId: user.id },
      },
    },
    include: {
      projects: {
        where: {
          members: {
            some: { userId: user.id },
          },
        },
        include: {
          _count: {
            select: { articles: true },
          },
          articles: {
            select: { reviewStatus: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Article Review Workspace
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Projects</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-600">{user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
            <LogIn className="h-4 w-4 text-emerald-700" />
            Demo access
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-zinc-500">Email</dt>
              <dd className="font-medium">sourav@example.com</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Password</dt>
              <dd className="font-medium">Password123!</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm leading-6 text-zinc-600">
            Access is scoped by project membership. The server checks this again for every import and
            review update.
          </p>
        </aside>

        <div className="space-y-6">
          {organizations.length === 0 ? (
            <EmptyState />
          ) : (
            organizations.map((organization) => (
              <section key={organization.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-emerald-700" />
                  <h2 className="text-lg font-semibold">{organization.name}</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {organization.projects.map((project) => {
                    const reviewedCount = project.articles.filter(
                      (article) => article.reviewStatus !== "UNREVIEWED",
                    ).length;

                    return (
                      <Link
                        key={project.id}
                        href={`/projects/${project.id}`}
                        className="rounded-lg border border-zinc-200 bg-white p-5 transition hover:border-emerald-500 hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold">{project.name}</h3>
                            <p className="mt-2 min-h-10 text-sm leading-5 text-zinc-600">
                              {project.description}
                            </p>
                          </div>
                          <FolderKanban className="h-5 w-5 shrink-0 text-zinc-500" />
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                          <Metric label="Articles" value={project._count.articles} />
                          <Metric label="Reviewed" value={reviewedCount} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center">
      <FileSpreadsheet className="mx-auto h-8 w-8 text-zinc-400" />
      <h2 className="mt-3 text-lg font-semibold">No accessible projects</h2>
      <p className="mt-2 text-sm text-zinc-600">
        Seed the database to create a demo organization, project, and reviewer membership.
      </p>
    </div>
  );
}
