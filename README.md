# aspayr-worker
Aspayr Azure Functions for background jobs.

## Setup

1) Install tools and dependencies (requires Azure Functions Core Tools):

- `npm install -g azure-functions-core-tools@4`
- `npm install`

2) Copy `local.settings.sample.json` to `local.settings.json` and fill in (do not commit real secrets):

- `COSMOS_ENDPOINT`, `COSMOS_KEY`, `COSMOS_DATABASE_ID`
- `TRANSACTIONS_CONTAINER_ID`, `CONSENTS_CONTAINER_ID`
- `YAPILY_APPLICATION_UUID`, `YAPILY_APPLICATION_SECRET`, optional `YAPILY_BASE_URL`
- Optional: `SYNC_TRANSACTIONS_CRON`, `SYNC_LOOKBACK_DAYS`

3) Run locally:

- `npm start`

## Functions

- `sync-transactions` (HTTP GET/POST): trigger a sync for a `userId`; optional `accountIds` (CSV) and `lookbackDays`.
- `sync-transactions-timer` (Timer): scheduled sync for all users with consents; cron from `SYNC_TRANSACTIONS_CRON`.
