import { Pool, QueryResult, QueryResultRow } from 'pg';
import { getDatabaseConnectionString } from './env';

const globalForDb = global as unknown as { 
  dbPool?: Pool; 
  dbInitialized?: boolean;
  dbConnStr?: string;
};

export function getPool(): Pool {
  const connectionString = getDatabaseConnectionString();
  
  if (!connectionString) {
    throw new Error('Database connection string could not be resolved. Please verify DATABASE_URL or DB_HOST in .env.local or backend/.env.');
  }

  if (globalForDb.dbPool && globalForDb.dbConnStr === connectionString) {
    return globalForDb.dbPool;
  }

  if (globalForDb.dbPool) {
    try {
      globalForDb.dbPool.end().catch(() => {});
    } catch {}
  }

  const newPool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  globalForDb.dbPool = newPool;
  globalForDb.dbConnStr = connectionString;
  return newPool;
}

// Proxy export for backward compatibility
export const pool = {
  connect: () => getPool().connect(),
  query: (text: string, params?: any[]) => getPool().query(text, params),
  end: () => getPool().end(),
};

// Auto-migrate tables on first query if they don't exist
async function ensureTables() {
  if (globalForDb.dbInitialized) return;
  
  try {
    const activePool = getPool();
    const client = await activePool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          full_name VARCHAR(255) NOT NULL,
          password_hash TEXT NOT NULL,
          role VARCHAR(100) DEFAULT 'exploration_geologist',
          organization VARCHAR(255) DEFAULT 'Independent / Exploration',
          is_verified BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS otp_codes (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          code VARCHAR(10) NOT NULL,
          type VARCHAR(50) DEFAULT 'verification',
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS rate_limits (
          key VARCHAR(255) PRIMARY KEY,
          failed_attempts INT DEFAULT 0,
          locked_until TIMESTAMPTZ,
          updated_at TIMESTAMPTZ DEFAULT now()
        );
      `);
      globalForDb.dbInitialized = true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database initialization note:', err);
    throw err;
  }
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  await ensureTables();
  const activePool = getPool();
  const client = await activePool.connect();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}
