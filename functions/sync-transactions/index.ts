import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getConsentsContainer } from "../../src/lib/cosmos";
import { syncTransactionsForUser } from "../../src/lib/syncTransactionsForUser";

function parseAccountIds(value: unknown): string[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value.map((v) => `${v}`.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return undefined;
}

app.http("sync-transactions", {
  methods: ["GET", "POST"],
  authLevel: "function",
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) as Record<string, unknown> : {};
    const userId = (req.query.get("userId") || body.userId)?.toString();

    const accountIds = parseAccountIds(req.query.get("accountIds") || body.accountIds);
    const lookbackRaw = req.query.get("lookbackDays") || body.lookbackDays;
    const lookbackDays = lookbackRaw ? Number.parseInt(`${lookbackRaw}`, 10) : undefined;

    // Determine which users to process. If userId is provided, just that one; otherwise all consent docs.
    let userIds: string[] = [];
    if (userId) {
      userIds = [userId];
    } else {
      const consentsContainer = await getConsentsContainer();
      const { resources } = await consentsContainer.items
        .query({ query: "SELECT c.id, c.userId FROM c" })
        .fetchAll();
      userIds = Array.from(
        new Set(
          resources
            .map((doc: any) => doc?.id || doc?.userId)
            .filter((v: any): v is string => Boolean(v))
        )
      );
    }

    if (!userIds.length) {
      return { status: 404, jsonBody: { error: "No users found to sync" } };
    }

    const results: Array<{ userId: string; success: boolean; result?: unknown; error?: string }> = [];

    for (const uid of userIds) {
      try {
        const result = await syncTransactionsForUser(uid, {
          accountIds,
          lookbackDays,
          logger: ctx,
        });
        results.push({ userId: uid, success: true, result });
      } catch (err: any) {
        ctx.error(`[sync-transactions] Failed for user ${uid}: ${err.message}`);
        results.push({ userId: uid, success: false, error: err?.message || "Unknown error" });
      }
    }

    return {
      status: 200,
      jsonBody: {
        success: true,
        processed: results.length,
        results,
      },
    };
  },
});
