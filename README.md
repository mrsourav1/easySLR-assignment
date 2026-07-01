# EasySLR Article Review Workspace

A focused full-stack product slice for importing PubMed-style article exports into project-scoped review workspaces.

## Stack

- Next.js App Router with React and TypeScript
- Tailwind CSS
- Prisma 7 with PostgreSQL
- NextAuth/Auth.js credentials authentication
- Server actions and route handlers for typed backend behavior
- Vitest for focused business-logic tests

## Local Setup

### Option A: Docker Compose

Run the full app and database:

```bash
docker compose up --build
```

Open `http://localhost:3001`.

The app container waits for Postgres, applies Prisma migrations, and seeds demo data automatically.

Demo credentials:

Use this account for now when reviewing the assignment locally:

- Email: `sourav@example.com`
- Password: `Password123!`

To reset the Docker database:

```bash
docker compose down -v
docker compose up --build
```

### Option B: Local Node + Postgres

1. Install dependencies:

```bash
npm install
```

2. Create environment variables:

```bash
cp .env.example .env
```

3. Start only PostgreSQL:

```bash
docker compose up -d postgres
```

4. Generate Prisma client, run migrations, and seed demo data:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

5. Start the app on the same port used by `NEXTAUTH_URL` in `.env.example`:

```bash
npm run dev -- --port 3001
```

Open `http://localhost:3001`.

Demo credentials:

Use this account for now when reviewing the assignment locally:

- Email: `sourav@example.com`
- Password: `Password123!`

## Product Scope

The app models the assignment's required domain:

- Organizations contain projects.
- Users belong to organizations and projects.
- Articles belong to projects.
- Project membership is checked on the server for every project page, import, review update, and CSV export.

The candidate-designed review workflow is intentionally simple:

- `Unreviewed`
- `Include`
- `Exclude`
- `Maybe`

Reviewers can also set priority, add comma-separated labels, and write notes. This keeps the workflow useful for screening without turning the assignment into a full systematic-review platform.

## Article Import

The import flow accepts `.xlsx` files with PubMed-style columns:

The provided sample file is included at `sample_article_import.xlsx`.

- `PMID`
- `Title`
- `Authors`
- `Citation`
- `First Author`
- `Journal/Book`
- `Publication Year`
- `Create Date`
- `PMCID`
- `NIHMS ID`
- `DOI`

Validation choices:

- `Title` is required because reviewers need a stable human-readable article identity.
- `Publication Year` must be a four-digit year between 1800 and next year.
- `Create Date` must be parseable when provided.
- Blank optional identifiers are allowed.
- Rows without both PMID and DOI are allowed with a warning because older exports may be incomplete.
- Duplicate detection checks DOI, PMID, and a fallback title/journal/year fingerprint.
- Invalid and duplicate rows are skipped rather than blocking the whole import.
- Each import writes an `ImportRun` record with row counts and validation details.

## Architecture Notes

- `prisma/schema.prisma` contains the data model and database constraints.
- `src/lib/article-import.ts` contains pure import parsing and validation logic shared by server actions and tests.
- `src/lib/access.ts` centralizes project authorization checks.
- `src/app/actions.ts` contains server actions for import and review updates.
- `src/app/api/projects/[projectId]/export/route.ts` provides a protected CSV export.
- UI is split between server-rendered pages and small client components for form submission state.

## Tests

Run:

```bash
npm test
```

Current tests cover import validation behavior:

- valid rows and DOI normalization
- missing titles
- invalid publication years
- duplicate DOI/PMID/fingerprint handling
- warning-only rows without external identifiers

## Verification

Verified locally:

```bash
npm test
npm run lint
npm run build
```

## Deployment Status

Live demo:

https://easy-slr-assignment-seven.vercel.app

This submission is deployed on Vercel with Supabase Postgres. AWS/SST would be the preferred production deployment path for the assignment, but Vercel is suitable for a public demo URL.

For Vercel with Supabase, set these environment variables:

```bash
DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true"
PRISMA_MIGRATE_URL="postgresql://...pooler.supabase.com:5432/postgres"
NEXTAUTH_URL="https://your-vercel-app.vercel.app"
NEXTAUTH_SECRET="generate-a-long-random-secret"
```

Use this Vercel build command:

```bash
npm run vercel-build
```

After the first deployment, seed demo data once against the hosted database:

```bash
DATABASE_URL="your-hosted-database-url" npm run db:seed
```

If deploying, I would use SST with:

- PostgreSQL via RDS or a managed Postgres provider
- secrets managed outside git
- Prisma migrations run during release
- application logs forwarded to CloudWatch
- conservative database sizing and teardown notes to control cost

## Tradeoffs and Known Gaps

- Credentials auth is used for the assignment demo. Production would use an identity provider or email-based login.
- Imports currently commit valid rows immediately and summarize invalid rows in the latest import log. A richer preview/confirm step would be a good next enhancement.
- The article table is server-filtered and capped at 200 rows for this slice. Production would add pagination.
- Roles are modeled as owner/reviewer, but the UI does not yet expose membership management.
- Import validation is strict enough for the sample file, but a production PubMed importer would preserve more source metadata and handle more export variants.

## AI Usage

AI assistance was used to accelerate implementation planning, code drafting, and README drafting.

Personally verified:

- Prisma schema and access boundaries
- import validation choices against the provided sample structure
- tests, lint, and production build

One example of changing AI-assisted output:

- The import behavior was kept smaller than a full preview-and-confirm wizard. The assignment rewards scope control, so valid rows are imported immediately while rejected rows are recorded in an import log.

## Approximate Time Spent

Approximately 8-12 focused hours would be the intended implementation timebox for this scope.

## What I Would Improve Next

- Add an import preview step with row-level checkboxes before committing.
- Add pagination and saved table views.
- Add project/member management screens.
- Add Playwright coverage for login, import, review update, and unauthorized project access.
- Deploy on AWS with SST and document the release workflow.
