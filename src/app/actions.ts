"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { assertProjectAccess } from "@/lib/access";
import {
  buildArticleFingerprint,
  parseArticleWorkbook,
  validateArticleRows,
  type ExistingArticleKeys,
} from "@/lib/article-import";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/session";

export type ActionState = {
  ok: boolean;
  message: string;
  details?: string[];
};

const reviewSchema = z.object({
  articleId: z.string().min(1),
  projectId: z.string().min(1),
  reviewStatus: z.enum(["UNREVIEWED", "INCLUDE", "EXCLUDE", "MAYBE"]),
  priority: z.coerce.number().int().min(1).max(3),
  reviewerNotes: z.string().max(2000).optional(),
  labels: z.string().max(500).optional(),
});

export async function updateArticleReview(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireCurrentUser();
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ok: false,
      message: "Review update failed validation.",
      details: parsed.error.issues.map((issue) => issue.message),
    };
  }

  await assertProjectAccess(user.id, parsed.data.projectId);

  const article = await prisma.article.findFirst({
    where: {
      id: parsed.data.articleId,
      projectId: parsed.data.projectId,
    },
    select: { id: true },
  });

  if (!article) {
    return { ok: false, message: "Article was not found in this project." };
  }

  await prisma.article.update({
    where: { id: parsed.data.articleId },
    data: {
      reviewStatus: parsed.data.reviewStatus,
      priority: parsed.data.priority,
      reviewerNotes: parsed.data.reviewerNotes?.trim() || null,
      labels: parseLabels(parsed.data.labels),
      reviewedAt: parsed.data.reviewStatus === "UNREVIEWED" ? null : new Date(),
      reviewedById: parsed.data.reviewStatus === "UNREVIEWED" ? null : user.id,
    },
  });

  revalidatePath(`/projects/${parsed.data.projectId}`);
  return { ok: true, message: "Review decision saved." };
}

const importSchema = z.object({
  projectId: z.string().min(1),
});

export async function importArticles(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireCurrentUser();
  const parsed = importSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, message: "Missing project id for import." };
  }

  await assertProjectAccess(user.id, parsed.data.projectId);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a non-empty .xlsx file to import." };
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { ok: false, message: "Only .xlsx files are supported for this assignment import." };
  }

  if (file.size > 2_000_000) {
    return { ok: false, message: "The import file is too large for this demo workspace." };
  }

  const existingArticles = await prisma.article.findMany({
    where: { projectId: parsed.data.projectId },
    select: {
      pmid: true,
      doi: true,
      title: true,
      journal: true,
      publicationYear: true,
    },
  });

  const existingKeys: ExistingArticleKeys = {
    pmids: new Set(existingArticles.map((article) => article.pmid).filter(Boolean) as string[]),
    dois: new Set(existingArticles.map((article) => article.doi).filter(Boolean) as string[]),
    fingerprints: new Set(
      existingArticles.map((article) =>
        buildArticleFingerprint({
          title: article.title,
          journal: article.journal,
          publicationYear: article.publicationYear,
        }),
      ),
    ),
  };

  let validation;
  try {
    const buffer = await file.arrayBuffer();
    const rows = await parseArticleWorkbook(buffer);
    validation = validateArticleRows(rows, existingKeys);
  } catch (error) {
    await prisma.importRun.create({
      data: {
        projectId: parsed.data.projectId,
        uploadedById: user.id,
        fileName: file.name,
        status: "FAILED",
        totalRows: 0,
        insertedRows: 0,
        skippedRows: 0,
        errorRows: 1,
        duplicateRows: 0,
        validationJson: toJsonValue({
          error: error instanceof Error ? error.message : "Unknown import error",
        }),
      },
    });
    return {
      ok: false,
      message: error instanceof Error ? error.message : "The workbook could not be parsed.",
    };
  }

  if (validation.acceptedRows.length > 0) {
    await prisma.article.createMany({
      data: validation.acceptedRows.map((row) => ({
        projectId: parsed.data.projectId,
        pmid: row.pmid,
        title: row.title,
        authors: row.authors,
        citation: row.citation,
        firstAuthor: row.firstAuthor,
        journal: row.journal,
        publicationYear: row.publicationYear,
        createDate: row.createDate,
        pmcid: row.pmcid,
        nihmsId: row.nihmsId,
        doi: row.doi,
      })),
      skipDuplicates: true,
    });
  }

  const skippedRows = validation.rejectedRows.length + validation.duplicateRows.length;
  await prisma.importRun.create({
    data: {
      projectId: parsed.data.projectId,
      uploadedById: user.id,
      fileName: file.name,
      status: skippedRows > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
      totalRows: validation.totalRows,
      insertedRows: validation.acceptedRows.length,
      skippedRows,
      errorRows: validation.rejectedRows.length,
      duplicateRows: validation.duplicateRows.length,
      validationJson: toJsonValue({
        rejectedRows: validation.rejectedRows,
        duplicateRows: validation.duplicateRows,
        warnings: validation.warnings,
      }),
    },
  });

  revalidatePath(`/projects/${parsed.data.projectId}`);

  const details = [
    `${validation.acceptedRows.length} imported`,
    `${validation.rejectedRows.length} invalid`,
    `${validation.duplicateRows.length} duplicate`,
    `${validation.warnings.length} warning`,
  ];

  return {
    ok: validation.acceptedRows.length > 0,
    message:
      skippedRows > 0
        ? "Import completed with rows skipped. Review the latest import log below."
        : "Import completed successfully.",
    details,
  };
}

function parseLabels(value: string | undefined) {
  if (!value) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean)
        .slice(0, 8),
    ),
  );
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
