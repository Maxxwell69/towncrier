# Towncrier

Towncrier is a central blog hub for generating, editing, and publishing SEO blog posts across multiple Vercel-hosted websites.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in the values.

3. Run database migrations and seed the admin user:

```bash
npm run db:dev
npm run db:seed
```

4. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), log in with the seeded admin account, and create your first site profile.

## MVP Features

- Email/password admin login.
- Manage Vercel site profiles with domain, location, author, categories, and future posting days.
- Generate blog drafts with Claude.
- Edit drafts, SEO metadata, image fields, and publish into Towncrier.
- Serve published posts through public site APIs for Vercel websites.
- Optionally trigger Vercel revalidation on publish.
- Railway health endpoint at `/api/health`.

## Railway Deployment

Create one Railway web service and one Railway Postgres service. Set these variables in Railway:

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `SESSION_SECRET`
- `ENCRYPTION_KEY`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ANTHROPIC_API_KEY`
- `CLAUDE_MODEL`
- Optional legacy GHL variables: `GHL_API_BASE_URL`, `GHL_API_VERSION`, `GHL_CREATE_BLOG_POST_PATH`

The included `railway.json` runs `npm run railway:build`, applies Prisma migrations on start, and checks `/api/health`.

## Vercel Site Integration

Each Vercel website adds a `/blog` index and `/blog/[slug]` detail page that fetch from Towncrier:

```text
GET /api/v1/sites/:siteSlug/posts
GET /api/v1/sites/:siteSlug/posts/:postSlug
GET /api/v1/sites/:siteSlug/categories
```

See `docs/vercel-site-integration.md` for drop-in examples.

## Legacy GHL Note

The GHL adapter remains available for sites truly hosted in GHL, but Vercel-hosted sites should use Towncrier as the central blog API.
