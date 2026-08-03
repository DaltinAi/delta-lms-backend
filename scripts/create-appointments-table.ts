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

async function createTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS appointments_delta (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL,
      lead_id UUID NOT NULL,
      current_stage_id UUID NOT NULL,
      created_by UUID NOT NULL,
      handled_by UUID,
      appointment_date DATE NOT NULL,
      appointment_time TIME NOT NULL,
      remark TEXT,
      status VARCHAR(50) DEFAULT 'SCHEDULED',
      is_deleted BOOLEAN DEFAULT false,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `;
  try {
    await pool.query(query);
    console.log('appointments_delta table created successfully.');
  } catch (err) {
    console.error('Error creating table:', err);
  } finally {
    await pool.end();
  }
}

createTable();
