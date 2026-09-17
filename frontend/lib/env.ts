import fs from 'fs';
import path from 'path';

let envLoaded = false;

export function loadEnv(): void {
  if (envLoaded) return;

  const candidatePaths = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), 'frontend/.env.local'),
    path.resolve(process.cwd(), '../frontend/.env.local'),
    path.resolve(process.cwd(), '../backend/.env'),
    path.resolve(process.cwd(), 'backend/.env'),
    path.resolve(__dirname, '../../.env.local'),
    path.resolve(__dirname, '../../../backend/.env'),
  ];

  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf-8');
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!process.env[key] && val) {
              process.env[key] = val;
            }
          }
        }
      } catch (err) {
        // Silently continue to next candidate
      }
    }
  }

  envLoaded = true;
}

// Auto-run on first import
loadEnv();

export function getDatabaseConnectionString(): string {
  loadEnv();
  const raw =
    process.env.DATABASE_URL ||
    (process.env.DB_HOST && process.env.DB_PASSWORD
      ? `postgres://${process.env.DB_USERNAME || 'postgres'}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT || '5432'}/${process.env.DB_DATABASE || 'postgres'}`
      : '');

  return raw.replace(/[?&]sslmode=[^&]+/g, '');
}

export function getResendApiKey(): string {
  loadEnv();
  return process.env.RESEND_API_KEY || '';
}

export function getMailFromAddress(): string {
  loadEnv();
  return process.env.MAIL_FROM_ADDRESS || 'noreply@tryagrochain.com';
}

export function getMailFromName(): string {
  loadEnv();
  return process.env.MAIL_FROM_NAME || 'GeoMiner';
}
