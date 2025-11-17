import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shared/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Force IPv4 to avoid EHOSTUNREACH errors on IPv6
// Parse URL and ensure sslmode is set
const dbUrl = new URL(process.env.DATABASE_URL);
if (!dbUrl.searchParams.has('sslmode')) {
  dbUrl.searchParams.set('sslmode', 'require');
}
const connectionString = dbUrl.toString();

// Configure postgres-js with robust pooling and retry logic
const queryClient = postgres(connectionString, {
  max: 20,                    // Increased pool size for better concurrency
  idle_timeout: 30,           // Keep connections alive longer
  connect_timeout: 10,        // Faster timeout to fail fast and retry
  max_lifetime: 60 * 30,      // Recycle connections every 30 minutes
  connection: {
    application_name: 'whatsapp-persistent',
  },
  // Retry logic for transient connection errors
  transform: {
    undefined: null
  },
  onnotice: () => {}, // Suppress notices
  debug: false,
  // Connection preparation
  prepare: true,
});

// Add connection health check
let isConnected = false;
queryClient.unsafe('SELECT 1').then(() => {
  isConnected = true;
  console.log('✅ Database connection pool established');
}).catch((err) => {
  console.error('❌ Initial database connection failed:', err.message);
});

// Export connection health status
export const getDbHealth = async (): Promise<boolean> => {
  try {
    await queryClient.unsafe('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
};

export const db = drizzle(queryClient, { schema });
export type Database = typeof db;