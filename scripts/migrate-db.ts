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

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Creating schema with _delta postfix...');

    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    await client.query(`
      CREATE TABLE IF NOT EXISTS companies_delta (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL,
        subdomain TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users_delta (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        firebase_uid TEXT UNIQUE,
        company_id UUID NOT NULL REFERENCES companies_delta(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        password TEXT,
        first_name TEXT,
        last_name TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS stages_delta (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          company_id UUID NOT NULL REFERENCES companies_delta(id) ON DELETE CASCADE,
          key TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          sort_order INT NOT NULL DEFAULT 100,
          is_active BOOLEAN NOT NULL DEFAULT true,
          is_default BOOLEAN NOT NULL DEFAULT false,
          stage_type TEXT DEFAULT 'normal',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (company_id, key),
          UNIQUE (company_id, name)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS leads_delta (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          company_id UUID NOT NULL REFERENCES companies_delta(id) ON DELETE CASCADE,
          created_by UUID REFERENCES users_delta(id),
          current_stage_id UUID REFERENCES stages_delta(id),
          first_name TEXT,
          last_name TEXT,
          phone TEXT,
          email TEXT,
          data JSONB DEFAULT '{}'::jsonb,
          is_deleted BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS lead_stage_history_delta (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          lead_id UUID NOT NULL REFERENCES leads_delta(id) ON DELETE CASCADE,
          company_id UUID NOT NULL,
          from_stage_id UUID REFERENCES stages_delta(id),
          to_stage_id UUID REFERENCES stages_delta(id),
          changed_by UUID REFERENCES users_delta(id),
          remark TEXT,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS follow_ups_delta (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          lead_id UUID NOT NULL REFERENCES leads_delta(id) ON DELETE CASCADE,
          company_id UUID NOT NULL REFERENCES companies_delta(id) ON DELETE CASCADE,
          scheduled_for TIMESTAMPTZ NOT NULL,
          mode TEXT NOT NULL,
          note TEXT,
          status TEXT DEFAULT 'pending',
          created_by UUID REFERENCES users_delta(id),
          completed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens_delta (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token TEXT NOT NULL UNIQUE,
        user_id UUID NOT NULL REFERENCES users_delta(id) ON DELETE CASCADE,
        is_used BOOLEAN NOT NULL DEFAULT false,
        is_revoked BOOLEAN NOT NULL DEFAULT false,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS password_resets_delta (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users_delta(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        is_used BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION trigger_set_timestamp_delta()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // We can ignore adding triggers if it fails due to existing ones, but we'll try:
    console.log('Adding triggers...');
    await client.query(`
      DROP TRIGGER IF EXISTS trg_stages_delta_updated_at ON stages_delta;
      CREATE TRIGGER trg_stages_delta_updated_at
      BEFORE UPDATE ON stages_delta
      FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp_delta();

      DROP TRIGGER IF EXISTS trg_leads_delta_updated_at ON leads_delta;
      CREATE TRIGGER trg_leads_delta_updated_at
      BEFORE UPDATE ON leads_delta
      FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp_delta();
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS stage_groups_delta (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES companies_delta(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE (company_id, name)
      );
    `);
    console.log('Created stage_groups_delta table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS stage_group_members_delta (
        stage_group_id UUID REFERENCES stage_groups_delta(id) ON DELETE CASCADE,
        stage_id UUID REFERENCES stages_delta(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (stage_group_id, stage_id)
      );
    `);
    console.log('Created stage_group_members_delta table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS role_stage_permissions_delta (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES companies_delta(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        stage_id UUID REFERENCES stages_delta(id) ON DELETE CASCADE,
        can_view BOOLEAN DEFAULT true,
        can_move_to BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE (company_id, role, stage_id)
      );
    `);
    console.log('Created role_stage_permissions_delta table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_invitations_delta (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES companies_delta(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'telecaller',
        token VARCHAR(255) NOT NULL UNIQUE,
        invited_by UUID REFERENCES users_delta(id) ON DELETE CASCADE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        is_used BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('Created user_invitations_delta table');

    await client.query('COMMIT');
    console.log('Migration completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
