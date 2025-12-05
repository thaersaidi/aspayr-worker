import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
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
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const userId = (req.query.get("userId") || body.userId)?.toString();

    if (!userId) {
      return { status: 400, jsonBody: { error: "userId is required" } };
    }

    const accountIds = parseAccountIds(req.query.get("accountIds") || body.accountIds);
    const lookbackRaw = req.query.get("lookbackDays") || body.lookbackDays;
    const lookbackDays = lookbackRaw ? Number.parseInt(`${lookbackRaw}`, 10) : undefined;

    const result = await syncTransactionsForUser(userId, {
      accountIds,
      lookbackDays,
      logger: ctx.log,
    });

    return {
      status: 200,
      jsonBody: {
        success: true,
        userId,
        result,
      },
    };
  },
});
