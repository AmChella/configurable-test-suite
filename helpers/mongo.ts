import { MongoClient, Db, Collection, Document } from "mongodb";
import { logger } from "./logger";

let client: MongoClient | null = null;
let db: Db | null = null;

const DEFAULT_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DEFAULT_DB = process.env.MONGO_DB || "testreports";

export async function connectMongo(): Promise<Db | null> {
  try {
    if (db) return db;
    if (!DEFAULT_URI) return null;
    client = new MongoClient(DEFAULT_URI);
    await client.connect();
    db = client.db(DEFAULT_DB);
    logger.info(`Connected to MongoDB db=${DEFAULT_DB}`, "mongo");
    return db;
  } catch (e: any) {
    logger.warn(`Mongo connection failed: ${e?.message || e}`, "mongo");
    return null;
  }
}

export function getCollection<T extends Document = Document>(name: string): Collection<T> | null {
  if (!db) return null;
  return db.collection<T>(name);
}

export async function closeMongo() {
  try {
    await client?.close();
  } catch {}
  client = null;
  db = null;
}
