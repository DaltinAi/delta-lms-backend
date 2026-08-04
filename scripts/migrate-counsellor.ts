import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function migrateCounsellor() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Starting Counsellor Migration...');

    // 1. Add role column to stages_delta if it doesn't exist
    console.log('Adding role column to stages_delta...');
    await client.query(`
      ALTER TABLE stages_delta 
      ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'telecaller';
    `);

    // 2. Drop existing unique constraints
    console.log('Updating constraints on stages_delta...');
    await client.query(`
      ALTER TABLE stages_delta DROP CONSTRAINT IF EXISTS stages_delta_company_id_key_key;
      ALTER TABLE stages_delta DROP CONSTRAINT IF EXISTS stages_delta_company_id_name_key;
    `);

    // 3. Add new unique constraints that include role
    await client.query(`
      ALTER TABLE stages_delta DROP CONSTRAINT IF EXISTS stages_delta_company_id_key_role_key;
      ALTER TABLE stages_delta ADD CONSTRAINT stages_delta_company_id_key_role_key UNIQUE (company_id, key, role);
      
      ALTER TABLE stages_delta DROP CONSTRAINT IF EXISTS stages_delta_company_id_name_role_key;
      ALTER TABLE stages_delta ADD CONSTRAINT stages_delta_company_id_name_role_key UNIQUE (company_id, name, role);
    `);

    // 4. Create enrollments_delta table
    console.log('Creating enrollments_delta table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS enrollments_delta (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          lead_id UUID NOT NULL REFERENCES leads_delta(id) ON DELETE CASCADE,
          company_id UUID NOT NULL REFERENCES companies_delta(id) ON DELETE CASCADE,
          counsellor_id UUID REFERENCES users_delta(id),
          country VARCHAR(100) NOT NULL,
          preferred_city VARCHAR(100),
          package_amount NUMERIC(12, 2) NOT NULL,
          advance_fee NUMERIC(12, 2) NOT NULL,
          advance_type VARCHAR(50) NOT NULL,
          post_visa_amount NUMERIC(12, 2) NOT NULL,
          agent_name VARCHAR(100),
          amount_for_agent NUMERIC(12, 2),
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(lead_id)
      );
    `);

    await client.query('COMMIT');
    console.log('Counsellor Migration completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateCounsellor();
