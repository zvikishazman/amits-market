# Security policy

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Contact the repository owner through [LinkedIn](https://www.linkedin.com/in/zvishazman/) with the affected route or component, reproduction steps, and potential impact.

Do not include real credentials, personal data, or destructive proof-of-concept payloads.

## Supported version

Security updates apply to the latest commit on the `main` branch.

## Secrets and data

This repository must contain no production credentials or user data. Local configuration belongs in `.env`, which is ignored by Git. The values in `.env.example` are placeholders only.
