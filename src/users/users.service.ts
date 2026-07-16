import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { TableConstants } from '../utils/table-constants';
import { ErrorService } from '../common/error/error.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly dbService: DbService,
    private readonly errorService: ErrorService,
  ) {}

  /**
   * Returns an array of user_ids for telecallers who are active.
   */
  async getActiveTelecallers(): Promise<string[]> {
    try {
      const telecallers = await this.dbService.query(
        `SELECT id FROM ${TableConstants.USERS} WHERE LOWER(role) = 'telecaller'`,
      );

      return telecallers.rows.map((tc) => tc.id);
    } catch (error) {
      console.error('[UsersService] Error fetching active telecallers:', error);
      throw error;
    }
  }

  async getUserById(id: string): Promise<any> {
    try {
      const user = await this.dbService.query(
        `SELECT * FROM ${TableConstants.USERS} WHERE id = $1`,
        [id],
      );
      return user.rows.length > 0 ? user.rows[0] : null;
    } catch (error) {
      console.error('[UsersService] Error fetching user by ID:', error);
      throw error;
    }
  }

  async getProfile(userId: string): Promise<any> {
    const result = await this.dbService.query(
      `SELECT
        u.id,
        u.firebase_uid,
        u.email,
        u.role,
        u.first_name,
        u.last_name,
        u.created_at as user_created_at,
        c.id as company_id,
        c.name as company_name,
        c.subdomain as company_subdomain,
        c.created_at as company_created_at
      FROM ${TableConstants.USERS} u
      JOIN ${TableConstants.COMPANIES} c ON u.company_id = c.id
      WHERE u.id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      firebase_uid: row.firebase_uid,
      email: row.email,
      role: row.role,
      first_name: row.first_name,
      last_name: row.last_name,
      created_at: row.user_created_at,
      company_id: row.company_id,
      company: {
        id: row.company_id,
        name: row.company_name,
        subdomain: row.company_subdomain,
        created_at: row.company_created_at,
      },
    };
  }
}
