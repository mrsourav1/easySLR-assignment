import { NextResponse } from "next/server";

import { assertProjectAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/api/projects/[projectId]/export">) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { projectId } = await context.params;
  await assertProjectAccess(user.id, projectId);

  const articles = await prisma.article.findMany({
    where: { projectId },
    orderBy: [{ reviewStatus: "asc" }, { publicationYear: "desc" }],
    select: {
      pmid: true,
      title: true,
      authors: true,
      journal: true,
      publicationYear: true,
      doi: true,
      reviewStatus: true,
      priority: true,
      labels: true,
      reviewerNotes: true,
    },
  });

  const rows = [
    [
      "PMID",
      "Title",
      "Authors",
      "Journal",
      "Publication Year",
      "DOI",
      "Review Status",
      "Priority",
      "Labels",
      "Reviewer Notes",
    ],
    ...articles.map((article) => [
      article.pmid,
      article.title,
      article.authors,
      article.journal,
      article.publicationYear,
      article.doi,
      article.reviewStatus,
      article.priority,
      article.labels.join("; "),
      article.reviewerNotes,
    ]),
  ];

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="project-${projectId}-articles.csv"`,
    },
  });
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
