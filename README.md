# Towncrier

Towncrier is a Next.js MVP for generating and publishing GoHighLevel blog posts across multiple website networks.

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

Open [http://localhost:3000](http://localhost:3000), log in with the seeded admin account, and create your first GHL blog network.

## MVP Features

- Email/password admin login.
- Store encrypted GHL credentials per network.
- Save blog ID, default topic, categories, and future posting days.
- Generate blog drafts with Claude.
- Publish drafts through a configurable GHL blog adapter.
- Railway health endpoint at `/api/health`.

## Railway Deployment

Create one Railway web service and one Railway Postgres service. Set these variables in Railway:

- `DATABASE_URL`
- `SESSION_SECRET`
- `ENCRYPTION_KEY`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ANTHROPIC_API_KEY`
- `CLAUDE_MODEL`
- `GHL_API_BASE_URL`
- `GHL_API_VERSION`
- `GHL_BLOG_POSTS_PATH_TEMPLATE`

The included `railway.json` runs `npm run railway:build`, applies Prisma migrations on start, and checks `/api/health`.

## GHL Adapter Note

The first adapter uses a configurable blog post path template because the final GHL auth/API shape is still open. If OAuth becomes the final connection method, update `src/lib/ghl.ts` and the encrypted credential payload without changing the dashboard flow.
