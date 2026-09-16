# Amit's Market

A full-stack social prediction-market application for private groups. Friends can create invite-only groups, publish questions, place virtual-currency predictions, follow live odds, and settle results transparently.

This repository is a portfolio-ready version of the original working project. It contains no production credentials or user data.

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
npx prisma migrate dev
npm run dev
```

Open `http://localhost:3000`.

Configure the values in `.env` before running Prisma or starting the application. Never commit that file.

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

The server validates membership and administrator permissions before mutating group data. Odds and payouts are derived from the current pool, while final balance changes and settlements are persisted through Prisma.

## Security

Secrets belong only in local or hosting-provider environment variables. See [SECURITY.md](SECURITY.md) for responsible reporting guidance.

## Status

The application is maintained as a portfolio project. Real-money wagering and payment processing are outside its scope; all balances are virtual.
