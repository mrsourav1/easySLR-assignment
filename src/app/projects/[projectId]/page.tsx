import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpDown, Download, FileSpreadsheet, Search } from "lucide-react";

import { ArticleReviewForm } from "@/components/article-review-form";
import { ImportArticlesForm } from "@/components/import-articles-form";
import { SignOutButton } from "@/components/sign-out-button";
import { assertProjectAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/session";

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const REVIEW_STATUSES = ["UNREVIEWED", "INCLUDE", "EXCLUDE", "MAYBE"] as const;
type ReviewStatusFilter = (typeof REVIEW_STATUSES)[number];

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params, searchParams }: ProjectPageProps) {
  const user = await requireCurrentUser();
  const { projectId } = await params;
  const query = await searchParams;
  const membership = await assertProjectAccess(user.id, projectId).catch(() => null);

  if (!membership) {
    notFound();
  }

  const q = getSingle(query.q)?.trim() ?? "";
  const status = parseStatus(getSingle(query.status));
  const sort = getSingle(query.sort) ?? "created-desc";

  const where = {
    projectId,
    ...(status ? { reviewStatus: status } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { authors: { contains: q, mode: "insensitive" as const } },
            { journal: { contains: q, mode: "insensitive" as const } },
            { doi: { contains: q, mode: "insensitive" as const } },
            { pmid: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [articles, counts, importRuns] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: getOrderBy(sort),
      include: { reviewedBy: { select: { name: true, email: true } } },
      take: 200,
    }),
    prisma.article.groupBy({
      by: ["reviewStatus"],
      where: { projectId },
      _count: true,
    }),
    prisma.importRun.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const statusCounts = Object.fromEntries(counts.map((item) => [item.reviewStatus, item._count]));
  const totalArticles = counts.reduce((sum, item) => sum + item._count, 0);

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-950">
              <ArrowLeft className="h-4 w-4" />
              Projects
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{membership.project.name}</h1>
            <p className="mt-1 text-sm text-zinc-600">
              {membership.project.organization.name} · {membership.role.toLowerCase()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/api/projects/${projectId}/export`}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </a>
            <SignOutButton />
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-6 xl:grid-cols-[340px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-lg border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-700" />
              <h2 className="font-semibold">Import articles</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Upload the provided PubMed-style `.xlsx`. Invalid and duplicate rows are skipped and
              recorded in the import log.
            </p>
            <ImportArticlesForm projectId={projectId} />
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="font-semibold">Review progress</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <SummaryTile label="Total" value={totalArticles} />
              <SummaryTile label="Unreviewed" value={statusCounts.UNREVIEWED ?? 0} />
              <SummaryTile label="Include" value={statusCounts.INCLUDE ?? 0} />
              <SummaryTile label="Exclude" value={statusCounts.EXCLUDE ?? 0} />
              <SummaryTile label="Maybe" value={statusCounts.MAYBE ?? 0} />
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="font-semibold">Latest imports</h2>
            <div className="mt-4 space-y-3">
              {importRuns.length === 0 ? (
                <p className="text-sm text-zinc-600">No imports yet.</p>
              ) : (
                importRuns.map((run) => (
                  <div key={run.id} className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
                    <div className="font-medium">{run.fileName}</div>
                    <div className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{run.status}</div>
                    <div className="mt-2 text-zinc-600">
                      {run.insertedRows} imported · {run.errorRows} invalid · {run.duplicateRows} duplicate
                    </div>
                    <ImportIssueList validationJson={run.validationJson} />
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>

        <section className="min-w-0 rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 p-5">
            <form className="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Search title, author, journal, DOI, PMID"
                  className="w-full rounded-md border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <select
                name="status"
                defaultValue={status ?? ""}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">All statuses</option>
                {REVIEW_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {formatStatus(item)}
                  </option>
                ))}
              </select>
              <select
                name="sort"
                defaultValue={sort}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="created-desc">Newest import</option>
                <option value="year-desc">Year newest</option>
                <option value="year-asc">Year oldest</option>
                <option value="title-asc">Title A-Z</option>
                <option value="status-asc">Status</option>
              </select>
              <button className="inline-flex items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
                <ArrowUpDown className="h-4 w-4" />
                Apply
              </button>
            </form>
          </div>

          {articles.length === 0 ? (
            <div className="p-12 text-center">
              <FileSpreadsheet className="mx-auto h-8 w-8 text-zinc-400" />
              <h2 className="mt-3 font-semibold">No articles match this view</h2>
              <p className="mt-2 text-sm text-zinc-600">
                Import articles or adjust the search and filter controls.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] border-separate border-spacing-0 text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="border-b border-zinc-200 px-4 py-3">Article</th>
                    <th className="border-b border-zinc-200 px-4 py-3">Source</th>
                    <th className="border-b border-zinc-200 px-4 py-3">Identifiers</th>
                    <th className="border-b border-zinc-200 px-4 py-3">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {articles.map((article) => (
                    <tr key={article.id} className="align-top">
                      <td className="border-b border-zinc-100 px-4 py-4">
                        <div className="max-w-xl font-medium leading-6">{article.title}</div>
                        <div className="mt-2 text-zinc-600">{article.authors || "Authors not provided"}</div>
                        {article.citation ? (
                          <div className="mt-2 text-xs leading-5 text-zinc-500">{article.citation}</div>
                        ) : null}
                      </td>
                      <td className="border-b border-zinc-100 px-4 py-4 text-zinc-700">
                        <div>{article.journal || "Journal not provided"}</div>
                        <div className="mt-2 text-xs text-zinc-500">
                          {article.publicationYear ?? "Year unknown"}
                        </div>
                      </td>
                      <td className="border-b border-zinc-100 px-4 py-4 text-xs leading-5 text-zinc-600">
                        <Identifier label="PMID" value={article.pmid} />
                        <Identifier label="DOI" value={article.doi} />
                        <Identifier label="PMCID" value={article.pmcid} />
                      </td>
                      <td className="border-b border-zinc-100 px-4 py-4">
                        <ArticleReviewForm
                          article={{
                            id: article.id,
                            projectId,
                            reviewStatus: article.reviewStatus,
                            priority: article.priority,
                            reviewerNotes: article.reviewerNotes,
                            labels: article.labels,
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}

function Identifier({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span className="font-medium text-zinc-500">{label}:</span> {value || "n/a"}
    </div>
  );
}

function ImportIssueList({ validationJson }: { validationJson: unknown }) {
  const issues = extractImportIssues(validationJson);
  if (issues.length === 0) {
    return null;
  }

  return (
    <ul className="mt-3 space-y-1 border-t border-zinc-200 pt-2 text-xs leading-5 text-red-700">
      {issues.slice(0, 4).map((issue, index) => (
        <li key={`${issue}-${index}`}>{issue}</li>
      ))}
      {issues.length > 4 ? <li className="text-zinc-500">+{issues.length - 4} more issues</li> : null}
    </ul>
  );
}

function extractImportIssues(validationJson: unknown) {
  if (!validationJson || typeof validationJson !== "object") {
    return [];
  }

  const data = validationJson as {
    rejectedRows?: { rowNumber: number; issues: { field: string; message: string }[] }[];
    duplicateRows?: { rowNumber: number; issues: { field: string; message: string }[] }[];
  };

  return [...(data.rejectedRows ?? []), ...(data.duplicateRows ?? [])].flatMap((row) =>
    row.issues.map((issue) => `Row ${row.rowNumber}: ${issue.field} - ${issue.message}`),
  );
}

function getSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseStatus(value: string | undefined): ReviewStatusFilter | null {
  return REVIEW_STATUSES.includes(value as ReviewStatusFilter) ? (value as ReviewStatusFilter) : null;
}

function getOrderBy(sort: string) {
  switch (sort) {
    case "year-desc":
      return [{ publicationYear: "desc" as const }, { createdAt: "desc" as const }];
    case "year-asc":
      return [{ publicationYear: "asc" as const }, { createdAt: "desc" as const }];
    case "title-asc":
      return [{ title: "asc" as const }];
    case "status-asc":
      return [{ reviewStatus: "asc" as const }, { updatedAt: "desc" as const }];
    default:
      return [{ createdAt: "desc" as const }];
  }
}

function formatStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}
