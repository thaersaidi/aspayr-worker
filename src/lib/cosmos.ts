import { CosmosClient, Container, Database } from "@azure/cosmos";

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = process.env.COSMOS_DATABASE_ID || "fin";
const defaultPartitionKey = "/userId";

let client: CosmosClient | null = null;
let databasePromise: Promise<Database> | null = null;
const containerPromises: Record<string, Promise<Container>> = {};

function getClient(): CosmosClient {
  if (!endpoint || !key) {
    throw new Error("COSMOS_ENDPOINT and COSMOS_KEY must be set");
  }
  if (!client) {
    client = new CosmosClient({ endpoint, key });
  }
  return client;
}

async function getDatabase(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = getClient()
      .databases.createIfNotExists({ id: databaseId })
      .then((r) => r.database);
  }
  return databasePromise;
}

async function getContainer(containerId: string, partitionKey: string = defaultPartitionKey): Promise<Container> {
  if (!containerPromises[containerId]) {
    containerPromises[containerId] = (async () => {
      const db = await getDatabase();
      const { container } = await db.containers.createIfNotExists({
        id: containerId,
        partitionKey: { paths: [partitionKey] },
      });
      return container;
    })();
  }
  return containerPromises[containerId];
}

export async function getTransactionsContainer(): Promise<Container> {
  const containerId = process.env.TRANSACTIONS_CONTAINER_ID || "Transactions";
  return getContainer(containerId);
}

export async function getConsentsContainer(): Promise<Container> {
  const containerId = process.env.CONSENTS_CONTAINER_ID || "Consents";
  return getContainer(containerId);
}
