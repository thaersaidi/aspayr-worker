import { app, InvocationContext, Timer } from "@azure/functions";
import { getConsentsContainer } from "../../src/lib/cosmos";
import { syncTransactionsForUser } from "../../src/lib/syncTransactionsForUser";

const SCHEDULE = process.env.SYNC_TRANSACTIONS_CRON || "0 0 */6 * * *";

app.timer("sync-transactions-timer", {
  schedule: SCHEDULE,
  handler: async (timer: Timer, ctx: InvocationContext) => {
    const consentsContainer = await getConsentsContainer();
    const { resources } = await consentsContainer.items
      .query({ query: "SELECT c.id FROM c" })
      .fetchAll();

    for (const doc of resources) {
      const userId = doc.id;
      try {
        await syncTransactionsForUser(userId, { logger: ctx.log });
      } catch (err: any) {
        ctx.log(`[sync-transactions-timer] Failed for user ${userId}: ${err.message}`);
      }
    }
  },
});
