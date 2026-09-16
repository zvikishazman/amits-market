# Amit's Market

A full-stack social prediction-market application for private groups. Friends can create invite-only groups, publish questions, place virtual-currency predictions, follow live odds, and settle results transparently.

This repository is a portfolio-ready version of the original working project. It contains no production credentials or user data.

## Ownership and contribution

I developed this personal project as the only developer, using AI assistance. The implementation includes the interface, authentication integration, database schema, group and question APIs, and prediction and settlement calculations. The original Git history is preserved; AI assistance is acknowledged rather than presented as a separate human collaborator.

## What it demonstrates

- End-to-end product development with Next.js, React, TypeScript, and PostgreSQL
- Google OAuth authentication and persistent sessions through Auth.js
- Role-aware group administration, invite codes, and membership management
- Dynamic parimutuel odds, proportional payouts, and debt settlement calculations
- Responsive English and Hebrew interfaces with LTR and RTL support
- Browser push-notification support and a mobile-friendly dashboard
- Prisma data modeling and server-side API workflows

## Core user flow

1. Sign in with Google.
2. Create a private group or join one with an invite code.
3. Publish a prediction question with two or more outcomes.
4. Place a virtual-currency prediction and watch the implied odds update.
5. Resolve the question and calculate payouts and member settlements.

## Tech stack

| Area | Technology |
| --- | --- |
| Front end | Next.js App Router, React, TypeScript, Tailwind CSS |
| Back end | Next.js route handlers, Auth.js |
| Data | PostgreSQL, Prisma ORM |
| Authentication | Google OAuth |
| Quality | Vitest, ESLint, TypeScript, GitHub Actions, Dependabot |

## Local setup

### Prerequisites

- Node.js 22 or later
- PostgreSQL
- Google OAuth credentials

### Run the project

```bash
git clone https://github.com/zvikishazman/amits-market.git
cd amits-market
npm ci
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp` if needed.

Configure the values in `.env` before running Prisma or starting the application. Never commit that file.

Use a new local development database in `DATABASE_URL`. Configure a Google OAuth Web application with the redirect URI `http://localhost:3000/api/auth/callback/google`, and fill in `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and a randomly generated `AUTH_SECRET`. Then run:

```bash
npx prisma migrate dev --name init
npm run dev
```

Open `http://localhost:3000`. The repository contains the Prisma schema, but no committed migration history; the command above creates the initial migration for your development database. Do not point it at an existing production database.

## Quality checks

```bash
npm run lint
npm test
npm run build
npm audit
```

GitHub Actions runs lint, unit tests, and the production build for every push and pull request.

## Architecture

- `src/app` contains the App Router pages and server route handlers.
- `src/components` contains reusable interface and layout components.
- `src/lib` contains Prisma access, odds and settlement logic, translations, and notification helpers.
- `prisma/schema.prisma` defines users, groups, questions, bets, memberships, and settlements.

The prediction POST handler checks authentication, membership, question status, deadline, option validity, duplicate predictions, and available virtual balance. Question modification checks creator or administrator status. Odds and payouts are derived from the current pool, while balance changes and settlements are persisted through Prisma. These checks are implementation details, not a claim that every endpoint or concurrent workflow has been fully audited.

See [architecture and engineering decisions](docs/architecture.md) for the request flow, transaction boundaries, calculation rules, and remaining limitations.

## Security

Secrets belong only in local or hosting-provider environment variables. See [SECURITY.md](SECURITY.md) for responsible reporting guidance.

## Status

The application is maintained as a portfolio project. Real-money wagering and payment processing are outside its scope; all balances are virtual.

The current edition passes lint, unit tests and the production build. Google sign-in and database-backed workflows require your own OAuth credentials and PostgreSQL instance; they have not been reverified end to end after this modernization. No hosted live application is provided by this repository.

On 2026-09-17, a separate source-only copy completed `npm ci`, passed lint, passed all 13 calculation and route-handler tests, and built successfully with Node.js 24.13.1. The build used local placeholder settings and no connected database. GitHub Actions uses Node.js 22. No database migration or live OAuth sign-in was performed as part of this check.
