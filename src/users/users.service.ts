import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

@Injectable()
export class UsersService {
  constructor(private readonly dbService: DbService) {}

  /**
   * Returns an array of user_ids for telecallers who are active.
   */
  async getActiveTelecallers(): Promise<string[]> {
    try {
      const telecallers = await this.dbService.query(
        `SELECT id FROM ${this.dbService.usersTable} WHERE LOWER(role) = 'telecaller'`,
      );
      
      return telecallers.rows.map(tc => tc.id);
    } catch (error) {
      console.error('[UsersService] Error fetching active telecallers:', error);
      throw error;
    }
  }

  async getUserById(id: string): Promise<any> {
    try {
      const user = await this.dbService.query(
        `SELECT * FROM ${this.dbService.usersTable} WHERE id = $1`,
        [id],
      );
      return user.rows.length > 0 ? user.rows[0] : null;
    } catch (error) {
      console.error('[UsersService] Error fetching user by ID:', error);
      throw error;
    }
  }
}

