import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { emptyExistingKeys, parseArticleWorkbook, validateArticleRows } from "@/lib/article-import";

describe("validateArticleRows", () => {
  it("accepts valid PubMed-style rows and normalizes DOI values", () => {
    const result = validateArticleRows([
      {
        PMID: "38910001",
        Title: "Digital adherence tools for diabetes care",
        Authors: "Rao A; Chen L",
        "Journal/Book": "Journal of Digital Health",
        "Publication Year": "2024",
        DOI: "https://doi.org/10.1000/JDH.2024.001",
      },
    ]);

    expect(result.acceptedRows).toHaveLength(1);
    expect(result.acceptedRows[0].doi).toBe("10.1000/jdh.2024.001");
    expect(result.rejectedRows).toHaveLength(0);
  });

  it("rejects missing titles and invalid publication years", () => {
    const result = validateArticleRows([
      {
        PMID: "38910004",
        Title: "",
        "Publication Year": "2024",
      },
      {
        PMID: "38910006",
        Title: "Invalid publication year example",
        "Publication Year": "Twenty twenty",
      },
    ]);

    expect(result.acceptedRows).toHaveLength(0);
    expect(result.rejectedRows).toHaveLength(2);
    expect(result.rejectedRows.flatMap((row) => row.issues.map((issue) => issue.field))).toEqual([
      "Title",
      "Publication Year",
    ]);
  });

  it("skips duplicates by DOI, PMID, and title fingerprint", () => {
    const existing = emptyExistingKeys();
    existing.pmids.add("existing-pmid");
    existing.dois.add("10.1000/existing");

    const result = validateArticleRows(
      [
        {
          PMID: "existing-pmid",
          Title: "Already imported by PMID",
          "Publication Year": "2024",
        },
        {
          PMID: "new-pmid",
          Title: "Already imported by DOI",
          "Publication Year": "2024",
          DOI: "10.1000/existing",
        },
        {
          PMID: "unique-pmid",
          Title: "Same title",
          "Journal/Book": "Same Journal",
          "Publication Year": "2024",
        },
        {
          PMID: "another-unique-pmid",
          Title: "Same title",
          "Journal/Book": "Same Journal",
          "Publication Year": "2024",
        },
      ],
      existing,
    );

    expect(result.acceptedRows).toHaveLength(1);
    expect(result.duplicateRows).toHaveLength(3);
  });

  it("warns but accepts rows with no strong external identifier", () => {
    const result = validateArticleRows([
      {
        Title: "Article without PMID or DOI",
        "Journal/Book": "Evidence Notes",
        "Publication Year": "2023",
      },
    ]);

    expect(result.acceptedRows).toHaveLength(1);
    expect(result.warnings[0].field).toBe("PMID/DOI");
  });

  it("parses and validates the provided sample workbook", async () => {
    const workbook = readFileSync(join(process.cwd(), "sample_article_import.xlsx"));
    const rows = await parseArticleWorkbook(workbook);
    const result = validateArticleRows(rows);

    expect(result.totalRows).toBe(25);
    expect(result.acceptedRows).toHaveLength(20);
    expect(result.rejectedRows).toHaveLength(3);
    expect(result.duplicateRows).toHaveLength(2);
  });
});
