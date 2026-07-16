import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { TableConstants } from '../utils/table-constants';

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  private static instance: DbService;
  public readonly usersTable: string;
  public readonly refreshTokensTable: string;
  public readonly passwordResetsTable: string;

  constructor() {
    if (DbService.instance) {
      return DbService.instance;
    }

    this.pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
      maxUses: 7500, // Close and replace a connection after it has been used 7500 times
    });

    this.usersTable = TableConstants.USERS;
    this.refreshTokensTable = TableConstants.REFRESH_TOKENS;
    this.passwordResetsTable = TableConstants.PASSWORD_RESETS;

    DbService.instance = this;
  }

  async onModuleInit() {
    try {
      // Test the connection during initialization
      const client = await this.pool.connect();
      Logger.log('Successfully connected to database');
      client.release();
    } catch (error) {
      Logger.error('Failed to connect to database:', error);
      throw error;
    }

    // Handle pool errors
    this.pool.on('error', (err: Error) => {
      Logger.error('Unexpected error on idle client', err);
      process.exit(1);
    });
  }

  async onModuleDestroy() {
    await this.pool.end();
    Logger.log('Database connection pool closed');
  }

  /**
   * Execute a query with parameters
   */
  async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;

      // Log slow queries (over 1 second)
      if (duration > 1000) {
        Logger.warn(`Slow query (${duration}ms): ${text}`);
      }

      return result;
    } catch (error) {
      Logger.error(`Query failed (${Date.now() - start}ms): ${text}`, error);
      throw error;
    }
  }

  /**
   * Execute queries within a transaction
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a client from the pool
   */
  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      Logger.error('Health check failed:', error);
      return false;
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }
}
