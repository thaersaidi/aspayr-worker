import axios, { AxiosInstance } from "axios";

const APP_UUID = process.env.YAPILY_APPLICATION_UUID;
const APP_SECRET = process.env.YAPILY_APPLICATION_SECRET;
const BASE_URL = process.env.YAPILY_BASE_URL || "https://api.yapily.com";

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function createYapilyClient(): AxiosInstance {
  const uuid = requireEnv(APP_UUID, "YAPILY_APPLICATION_UUID");
  const secret = requireEnv(APP_SECRET, "YAPILY_APPLICATION_SECRET");

  const auth = Buffer.from(`${uuid}:${secret}`).toString("base64");

  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    timeout: 15000,
  });
}

export async function fetchAccounts(client: AxiosInstance, consentToken: string) {
  const { data } = await client.get("/accounts", {
    headers: { consent: consentToken },
  });
  return (data?.data as unknown[]) || data || [];
}

export async function fetchTransactions(
  client: AxiosInstance,
  accountId: string,
  consentToken: string,
  fromIso?: string
) {
  const params: Record<string, string> = {};
  if (fromIso) {
    params.from = fromIso;
  }

  const { data } = await client.get(`/accounts/${accountId}/transactions`, {
    headers: { consent: consentToken },
    params,
  });

  return (data?.data as unknown[]) || data || [];
}
