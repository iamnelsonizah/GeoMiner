import { Pool, QueryResult, QueryResultRow } from 'pg';

const rawConnectionString =
  process.env.DATABASE_URL ||
  (process.env.DB_HOST && process.env.DB_PASSWORD
    ? `postgres://${process.env.DB_USERNAME || 'postgres'}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT || '5432'}/${process.env.DB_DATABASE || 'postgres'}?sslmode=require`
    : '');

// Strip any ?sslmode parameter so pg's ssl config overrides properly
const connectionString = rawConnectionString.replace(/[?&]sslmode=[^&]+/g, '');

const globalForDb = global as unknown as { dbPool?: Pool; dbInitialized?: boolean };

export const pool =
  globalForDb.dbPool ||
  new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.dbPool = pool;
}

// Auto-migrate tables on first query if they don't exist
async function ensureTables() {
  if (globalForDb.dbInitialized) return;
  
  try {
    const client = await pool.connect();
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
    console.error('Database migration check note:', err);
  }
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  await ensureTables();
  const client = await pool.connect();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}
