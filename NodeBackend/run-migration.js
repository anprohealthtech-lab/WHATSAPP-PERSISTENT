import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, 'migrations', '0001_add_campaign_tables.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('🔄 Running campaign tables migration...');
    
    await pool.query(sql);
    
    console.log('✅ Campaign tables created successfully!');
    console.log('\nCreated tables:');
    console.log('  - campaigns');
    console.log('  - campaign_recipients');
    console.log('  - message_variations');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
