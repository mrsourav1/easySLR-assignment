import ExcelJS from "exceljs";

export const REQUIRED_IMPORT_COLUMNS = ["Title"] as const;

export type ReviewStatusValue = "UNREVIEWED" | "INCLUDE" | "EXCLUDE" | "MAYBE";

export type ExistingArticleKeys = {
  pmids: Set<string>;
  dois: Set<string>;
  fingerprints: Set<string>;
};

export type ImportRowIssue = {
  rowNumber: number;
  field: string;
  message: string;
  severity: "error" | "warning";
};

export type ParsedArticleRow = {
  rowNumber: number;
  pmid: string | null;
  title: string;
  authors: string | null;
  citation: string | null;
  firstAuthor: string | null;
  journal: string | null;
  publicationYear: number | null;
  createDate: Date | null;
  pmcid: string | null;
  nihmsId: string | null;
  doi: string | null;
  fingerprint: string;
  warnings: ImportRowIssue[];
};

export type RejectedImportRow = {
  rowNumber: number;
  values: Record<string, unknown>;
  issues: ImportRowIssue[];
};

export type ImportValidationResult = {
  totalRows: number;
  acceptedRows: ParsedArticleRow[];
  rejectedRows: RejectedImportRow[];
  duplicateRows: RejectedImportRow[];
  warnings: ImportRowIssue[];
};

const COLUMN_ALIASES = {
  pmid: ["PMID", "PubMed ID"],
  title: ["Title", "Article Title"],
  authors: ["Authors", "Author"],
  citation: ["Citation"],
  firstAuthor: ["First Author", "FirstAuthor"],
  journal: ["Journal/Book", "Journal", "Journal Book"],
  publicationYear: ["Publication Year", "Year", "Pub Year"],
  createDate: ["Create Date", "Created Date"],
  pmcid: ["PMCID"],
  nihmsId: ["NIHMS ID", "NIHMS"],
  doi: ["DOI"],
} as const;

export async function parseArticleWorkbook(buffer: ArrayBuffer | Buffer): Promise<Record<string, unknown>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(toBuffer(buffer) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error("The workbook does not contain any sheets.");
  }

  const headerRow = worksheet.getRow(1);
  const headers = getRowValues(headerRow).map((header) => normalizeText(header));

  if (!headers.some(Boolean)) {
    throw new Error("The workbook does not contain a readable header row.");
  }

  const rows: Record<string, unknown>[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const rowObject = rowToObject(headers, getRowValues(row));
    if (Object.values(rowObject).some((value) => normalizeText(value) !== null)) {
      rows.push(rowObject);
    }
  });

  if (rows.length === 0) {
    throw new Error("The workbook does not contain any rows.");
  }

  return rows;
}

export function validateArticleRows(
  rows: Record<string, unknown>[],
  existingKeys: ExistingArticleKeys = emptyExistingKeys(),
): ImportValidationResult {
  const acceptedRows: ParsedArticleRow[] = [];
  const rejectedRows: RejectedImportRow[] = [];
  const duplicateRows: RejectedImportRow[] = [];
  const warnings: ImportRowIssue[] = [];
  const seenPmids = new Set<string>();
  const seenDois = new Set<string>();
  const seenFingerprints = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const issues: ImportRowIssue[] = [];
    const rowWarnings: ImportRowIssue[] = [];
    const title = readText(row, COLUMN_ALIASES.title);
    const pmid = readText(row, COLUMN_ALIASES.pmid);
    const doi = normalizeDoi(readText(row, COLUMN_ALIASES.doi));
    const journal = readText(row, COLUMN_ALIASES.journal);
    const publicationYearResult = parsePublicationYear(
      readText(row, COLUMN_ALIASES.publicationYear),
      rowNumber,
    );
    const createDateResult = parseCreateDate(readText(row, COLUMN_ALIASES.createDate), rowNumber);

    if (!title) {
      issues.push({
        rowNumber,
        field: "Title",
        message: "Title is required so reviewers can identify the article.",
        severity: "error",
      });
    }

    if (!pmid && !doi) {
      rowWarnings.push({
        rowNumber,
        field: "PMID/DOI",
        message: "No PMID or DOI was provided. The article can be imported but duplicate detection is weaker.",
        severity: "warning",
      });
    }

    if (publicationYearResult.issue) {
      issues.push(publicationYearResult.issue);
    }

    if (createDateResult.issue) {
      issues.push(createDateResult.issue);
    }

    const fingerprint = buildArticleFingerprint({
      title: title ?? "",
      journal,
      publicationYear: publicationYearResult.value,
    });

    const duplicateIssue = getDuplicateIssue({
      rowNumber,
      pmid,
      doi,
      fingerprint,
      seenPmids,
      seenDois,
      seenFingerprints,
      existingKeys,
    });

    if (duplicateIssue) {
      duplicateRows.push({ rowNumber, values: row, issues: [duplicateIssue] });
      continue;
    }

    if (issues.length > 0 || !title) {
      rejectedRows.push({ rowNumber, values: row, issues });
      continue;
    }

    if (pmid) seenPmids.add(pmid);
    if (doi) seenDois.add(doi);
    seenFingerprints.add(fingerprint);
    warnings.push(...rowWarnings);

    acceptedRows.push({
      rowNumber,
      pmid,
      title,
      authors: readText(row, COLUMN_ALIASES.authors),
      citation: readText(row, COLUMN_ALIASES.citation),
      firstAuthor: readText(row, COLUMN_ALIASES.firstAuthor),
      journal,
      publicationYear: publicationYearResult.value,
      createDate: createDateResult.value,
      pmcid: readText(row, COLUMN_ALIASES.pmcid),
      nihmsId: readText(row, COLUMN_ALIASES.nihmsId),
      doi,
      fingerprint,
      warnings: rowWarnings,
    });
  }

  return {
    totalRows: rows.length,
    acceptedRows,
    rejectedRows,
    duplicateRows,
    warnings,
  };
}

export function emptyExistingKeys(): ExistingArticleKeys {
  return {
    pmids: new Set(),
    dois: new Set(),
    fingerprints: new Set(),
  };
}

export function buildArticleFingerprint(input: {
  title: string;
  journal: string | null;
  publicationYear: number | null;
}) {
  return [
    normalizeForCompare(input.title),
    normalizeForCompare(input.journal ?? ""),
    input.publicationYear ?? "",
  ].join("|");
}

function getDuplicateIssue(input: {
  rowNumber: number;
  pmid: string | null;
  doi: string | null;
  fingerprint: string;
  seenPmids: Set<string>;
  seenDois: Set<string>;
  seenFingerprints: Set<string>;
  existingKeys: ExistingArticleKeys;
}): ImportRowIssue | null {
  const { rowNumber, pmid, doi, fingerprint, seenPmids, seenDois, seenFingerprints, existingKeys } =
    input;

  if (doi && (seenDois.has(doi) || existingKeys.dois.has(doi))) {
    return duplicateIssue(rowNumber, "DOI", doi);
  }

  if (pmid && (seenPmids.has(pmid) || existingKeys.pmids.has(pmid))) {
    return duplicateIssue(rowNumber, "PMID", pmid);
  }

  if (fingerprint && (seenFingerprints.has(fingerprint) || existingKeys.fingerprints.has(fingerprint))) {
    return duplicateIssue(rowNumber, "Title", "same title, journal, and year");
  }

  return null;
}

function duplicateIssue(rowNumber: number, field: string, value: string): ImportRowIssue {
  return {
    rowNumber,
    field,
    message: `Duplicate article detected by ${field}: ${value}.`,
    severity: "error",
  };
}

function parsePublicationYear(value: string | null, rowNumber: number) {
  if (!value) {
    return { value: null, issue: null };
  }

  if (!/^\d{4}$/.test(value)) {
    return {
      value: null,
      issue: {
        rowNumber,
        field: "Publication Year",
        message: "Publication year must be a four-digit year.",
        severity: "error" as const,
      },
    };
  }

  const year = Number(value);
  const maxYear = new Date().getFullYear() + 1;
  if (year < 1800 || year > maxYear) {
    return {
      value: null,
      issue: {
        rowNumber,
        field: "Publication Year",
        message: `Publication year must be between 1800 and ${maxYear}.`,
        severity: "error" as const,
      },
    };
  }

  return { value: year, issue: null };
}

function parseCreateDate(value: string | null, rowNumber: number) {
  if (!value) {
    return { value: null, issue: null };
  }

  const normalized = value.replaceAll(".", "/").replaceAll("-", "/");
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return {
      value: null,
      issue: {
        rowNumber,
        field: "Create Date",
        message: "Create date could not be parsed.",
        severity: "error" as const,
      },
    };
  }

  return { value: parsed, issue: null };
}

function readText(row: Record<string, unknown>, aliases: readonly string[]) {
  for (const alias of aliases) {
    const value = normalizeText(row[alias]);
    if (value) {
      return value;
    }
  }
  return null;
}

function rowToObject(headers: (string | null)[], row: unknown[]) {
  return headers.reduce<Record<string, unknown>>((accumulator, header, index) => {
    if (header) {
      accumulator[header] = row[index] ?? null;
    }
    return accumulator;
  }, {});
}

function getRowValues(row: ExcelJS.Row) {
  return Array.from({ length: row.cellCount }, (_, index) => normalizeCellValue(row.getCell(index + 1).value));
}

function normalizeCellValue(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date || typeof value !== "object") {
    return value;
  }

  if ("text" in value && typeof value.text === "string") {
    return value.text;
  }

  if ("result" in value) {
    return value.result;
  }

  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text).join("");
  }

  return String(value);
}

function toBuffer(buffer: ArrayBuffer | Buffer) {
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(new Uint8Array(buffer));
}

function normalizeText(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text || text.toLowerCase() === "nan") {
    return null;
  }
  return text;
}

function normalizeDoi(value: string | null) {
  if (!value) {
    return null;
  }
  return value.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim().toLowerCase();
}

function normalizeForCompare(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
