import { Container } from "@azure/cosmos";
import dayjs from "dayjs";
import { getConsentsContainer, getTransactionsContainer } from "./cosmos";
import { createYapilyClient, fetchAccounts, fetchTransactions } from "./yapily";

type Logger = { log: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

const SAFETY_DAYS = 2;
const DEFAULT_LOOKBACK_DAYS = Number.parseInt(process.env.SYNC_LOOKBACK_DAYS || "30", 10) || 30;

interface SyncOptions {
  accountIds?: string[];
  lookbackDays?: number;
  logger?: Logger;
}

interface SyncSummary {
  userId: string;
  accounts: Array<{
    accountId: string;
    consentId: string;
    institutionId?: string;
    fetched: number;
    upserted: number;
    from: string;
  }>;
}

function pickDate(candidate: any): string | null {
  const fields = [
    candidate?.bookingDateTime,
    candidate?.timestamp,
    candidate?.valueDateTime,
    candidate?.valueDate,
    candidate?.date,
    candidate?.createdAt,
    candidate?.updatedAt,
  ].filter(Boolean);
  if (fields.length === 0) return null;
  const first = fields[0];
  return typeof first === "string" ? first : null;
}

async function getLatestKnownDate(container: Container, userId: string, accountId: string): Promise<string | null> {
  const querySpec = {
    query: "SELECT TOP 1 c.bookingDateTime, c.valueDateTime, c.timestamp, c.updatedAt, c.createdAt FROM c WHERE c.userId = @userId AND c.accountId = @accountId ORDER BY c.updatedAt DESC",
    parameters: [
      { name: "@userId", value: userId },
      { name: "@accountId", value: accountId },
    ],
  };

  const { resources } = await container.items.query(querySpec).fetchAll();
  if (!resources.length) return null;
  return pickDate(resources[0]);
}

function toYapilyTransactionId(tx: any): string | null {
  return tx?.id || tx?.transactionId || tx?.internalTransactionId || null;
}

function materializeTransaction(
  tx: any,
  userId: string,
  accountId: string,
  consentId: string,
  institutionId?: string
) {
  const yapilyTransactionId = toYapilyTransactionId(tx);
  if (!yapilyTransactionId) return null;

  const id = `${userId}_${accountId}_${yapilyTransactionId}`;
  const bookingDateTime = pickDate(tx);

  return {
    ...tx,
    id,
    userId,
    accountId,
    consentId,
    institutionId,
    bookingDateTime,
    source: "yapily",
    syncedAt: new Date().toISOString(),
  };
}

export async function syncTransactionsForUser(userId: string, options: SyncOptions = {}): Promise<SyncSummary> {
  const logger = options.logger || console;
  const lookbackDays = options.lookbackDays || DEFAULT_LOOKBACK_DAYS;
  const targetAccountIds = options.accountIds?.length ? new Set(options.accountIds) : null;

  const [transactionsContainer, consentsContainer] = await Promise.all([
    getTransactionsContainer(),
    getConsentsContainer(),
  ]);

  // Load consents for user
  const { resources: consentDocs } = await consentsContainer.items
    .query({
      query: "SELECT c.consents FROM c WHERE c.id = @userId",
      parameters: [{ name: "@userId", value: userId }],
    })
    .fetchAll();

  const consentsArray: any[] = consentDocs[0]?.consents || [];
  const authorizedConsents = consentsArray.filter((c) => c?.status === "AUTHORIZED" && c?.consentToken);

  if (!authorizedConsents.length) {
    logger.warn(`[sync-transactions] No authorized consents found for user ${userId}`);
    return { userId, accounts: [] };
  }

  const client = createYapilyClient();
  const summary: SyncSummary = { userId, accounts: [] };

  for (const consent of authorizedConsents) {
    const consentToken = consent.consentToken;
    const consentId = consent.id || consent.consentId || "unknown";
    const institutionId = consent.institutionId;

    let accounts: any[] = [];
    try {
      accounts = await fetchAccounts(client, consentToken);
    } catch (err: any) {
      logger.error(`[sync-transactions] Failed to fetch accounts for consent ${consentId}: ${err.message}`);
      continue;
    }

    for (const account of accounts) {
      const accountId = account.id || account.accountId;
      if (!accountId) continue;
      if (targetAccountIds && !targetAccountIds.has(accountId)) continue;

      const latest = await getLatestKnownDate(transactionsContainer, userId, accountId);
      const from = latest ? dayjs(latest).subtract(SAFETY_DAYS, "day") : dayjs().subtract(lookbackDays, "day");
      const fromIso = from.toISOString();

      let transactions: any[] = [];
      try {
        transactions = await fetchTransactions(client, accountId, consentToken, fromIso);
      } catch (err: any) {
        logger.error(`[sync-transactions] Failed to fetch transactions for account ${accountId}: ${err.message}`);
        continue;
      }

      let upserted = 0;
      for (const tx of transactions) {
        const doc = materializeTransaction(tx, userId, accountId, consentId, institutionId);
        if (!doc) continue;
        await transactionsContainer.items.upsert(doc);
        upserted += 1;
      }

      summary.accounts.push({
        accountId,
        consentId,
        institutionId,
        fetched: transactions.length,
        upserted,
        from: fromIso,
      });

      logger.log(
        `[sync-transactions] user=${userId} account=${accountId} fetched=${transactions.length} upserted=${upserted} from=${fromIso}`
      );
    }
  }

  return summary;
}
