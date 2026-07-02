import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  private readonly tablePrefix = 'delta_';
  readonly usersTable = this.getTableName('users');
  readonly refreshTokensTable = this.getTableName('refresh_tokens');

  constructor() {
    const host = process.env.DB_HOST;
    const port = Number(process.env.DB_PORT || 5432);
    const user = process.env.DB_USERNAME;
    const password = process.env.DB_PASSWORD;
    const database = process.env.DB_NAME;
    const isLocalDatabase =
      host === 'localhost' || host === '127.0.0.1' || host === undefined;
    const useSsl = !isLocalDatabase;

    this.pool = new Pool({
      host,
      port,
      user,
      password,
      database,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    });
  }

  async onModuleInit() {
    // Test connection
    try {
      const client = await this.pool.connect();
      client.release();
      console.log('Successfully connected to PostgreSQL');
    } catch (err) {
      console.error('Failed to connect to PostgreSQL:', err);
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async query(text: string, params?: any[]) {
    return this.pool.query(text, params);
  }

  async withTransaction<T>(handler: (client: PoolClient) => Promise<T>) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await handler(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private getTableName(baseName: string) {
    return `${this.tablePrefix}${baseName}`;
  }
}
