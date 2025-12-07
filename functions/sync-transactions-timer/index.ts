import { app, InvocationContext, Timer } from "@azure/functions";
import { getConsentsContainer } from "../../src/lib/cosmos";
import { syncTransactionsForUser } from "../../src/lib/syncTransactionsForUser";

const SCHEDULE = process.env.SYNC_TRANSACTIONS_CRON || "0 0 */6 * * *";

app.timer("sync-transactions-timer", {
  schedule: SCHEDULE,
  handler: async (timer: Timer, ctx: InvocationContext) => {
    const consentsContainer = await getConsentsContainer();
    const { resources } = await consentsContainer.items
      .query({ query: "SELECT c.id, c.userId FROM c" })
      .fetchAll();

    ctx.log(`[sync-transactions-timer] found ${resources.length} consent docs`);

    for (const doc of resources) {
      const userId = doc.id || doc.userId;
      if (!userId) {
        ctx.warn("[sync-transactions-timer] skipping doc with no userId", doc);
        continue;
      }
      try {
        await syncTransactionsForUser(userId, { logger: ctx });
      } catch (err: any) {
        ctx.log(`[sync-transactions-timer] Failed for user ${userId}: ${err.message}`);
      }
    }
  },
});
