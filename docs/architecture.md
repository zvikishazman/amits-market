# Architecture and engineering decisions

## Implemented structure

```text
Next.js App Router pages and React components
  -> Auth.js session / Google OAuth
  -> Next.js server route handlers
  -> membership and request checks
  -> Prisma -> PostgreSQL

src/lib/odds.ts -> pure pool, payout and debt calculations
src/lib/i18n*  -> English/Hebrew presentation
```

The Prisma schema models users, OAuth accounts, sessions, groups, memberships, questions, options, predictions, push subscriptions, and settlements. Auth.js uses the Prisma adapter and adds the database user ID to the session.

## Decision 1: a single full-stack application

The project uses App Router pages and route handlers in the same Next.js application. This keeps interface and API deployment together and shares TypeScript models. It also couples the API to the Next.js runtime; this is not a separate FastAPI service or a microservice architecture.

## Decision 2: isolate calculation rules

`src/lib/odds.ts` has no database or authentication dependencies. Probabilities come from each option's share of the pool, and multipliers are total pool divided by the option pool. Potential payouts include the proposed prediction in the pool. Resolution payouts are proportional to winning stakes.

The debt helper is a distinct rule: each losing prediction is split equally among winning entries and rounded to two decimal places. It does not use proportional winning stakes. The two calculations should not be described as interchangeable financial accounting.

## Decision 3: check requests on the server and group related writes

The prediction POST route uses the authenticated session ID and the question's configured amount, rather than accepting a client-supplied user ID or stake. It checks membership, question scope, open status, deadline, valid option, previous predictions, and available balance before writing. The balance debit and prediction creation share a Prisma transaction. Question resolution also groups payout and balance changes in a transaction.

These transactions group writes; they do not prove concurrency safety. Duplicate-prediction and balance checks currently happen before the write transaction, and the schema has no unique user/question prediction constraint. Simultaneous requests need a separate database-backed concurrency test and stronger invariants before production use.

## Verification boundary

- Calculation tests exercise pool odds, prospective payouts, resolution payouts, and debt splitting.
- Route-handler tests exercise authentication and membership rejection, malformed JSON, closed questions, expired deadlines, invalid options, duplicate predictions, insufficient funds, and a valid debit/create flow.
- Route tests mock Auth.js and Prisma. They do not start PostgreSQL, exercise real OAuth, or verify database isolation and rollback behavior.
- Lint and a production build check the application as a whole.
- Google sign-in and database-backed flows still require a separate end-to-end check with development credentials.

## Product boundary

Balances are virtual. The application has no payment processing or real-money wagering integration. PostgreSQL values are currently floating-point numbers; production financial accounting would need explicit decimal precision and rounding policy. This is a personal portfolio project, not a claim of production readiness for financial transactions.
