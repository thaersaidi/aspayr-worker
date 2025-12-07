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

## Local testing examples (curl)

- All users (runs sync across all consent docs):

  ```bash
  curl -X POST "http://localhost:7071/api/sync-transactions" \
    -H "Content-Type: application/json" \
    -d '{}'
  ```

- Specific user and account:

  ```bash
  curl -X POST "http://localhost:7071/api/sync-transactions" \
    -H "Content-Type: application/json" \
    -d "{\"userId\":\"a58d723c-cb0f-4e3f-ac01-127497909656\",\"accountIds\":[\"100004000000000000000003\"]}"
  ```
