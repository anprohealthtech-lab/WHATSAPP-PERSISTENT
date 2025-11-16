import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shared/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Configure postgres-js for Supabase transaction-mode pooling
const queryClient = postgres(process.env.DATABASE_URL, {
  prepare: false,      // Required for transaction-mode poolers (Supavisor/PgBouncer)
  max: 10,            // Client-side connection pool size
  idle_timeout: 20,   // Idle connection timeout in seconds
  connect_timeout: 30 // Connection timeout in seconds
});

export const db = drizzle(queryClient, { schema });
export type Database = typeof db;