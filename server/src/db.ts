import { Pool } from "pg";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn("Warning: DATABASE_URL not set — database operations will fail");
}

export const pool = new Pool({ connectionString });

pool.on("error", (err) => {
  console.error("Unexpected Postgres pool error:", err);
});
