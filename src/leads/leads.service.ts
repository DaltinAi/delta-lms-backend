import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class LeadsService {
  constructor(
    private readonly dbService: DbService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Round-robin telecaller assignment.
   * Picks the telecaller with the fewest active (non-deleted) leads assigned.
   * Returns null silently if no telecallers exist — lead still gets created.
   */
  async assignTeleCounsellorRoundRobin(): Promise<string | null> {
    try {
      const activeTelecallers = await this.usersService.getActiveTelecallers();
      if (!activeTelecallers || activeTelecallers.length === 0) return null;

      const result = await this.dbService.query(
        `SELECT u.id
         FROM ${this.dbService.usersTable} u
         LEFT JOIN tbl_leads l ON l.assigned_to = u.id AND l.is_deleted = false
         WHERE u.role = 'telecaller'
           AND u.id = ANY($1)
         GROUP BY u.id
         ORDER BY COUNT(l.id) ASC
         LIMIT 1`,
        [activeTelecallers],
      );
      
      return result.rows.length > 0 ? result.rows[0].id : null;
    } catch (error) {
      console.error('[LeadsService] Error in assignTeleCounsellorRoundRobin:', error);
      // Never block lead creation due to assignment failure
      return null;
    }
  }

  /**
   * Records the telecaller assignment in history.
   * fromAssigneeId = null means first-time assignment.
   */
  async recordAssignmentHistory(
    leadId: string,
    fromAssigneeId: string | null,
    toAssigneeId: string | null,
    assignedBy: string | null,
    reason?: string,
  ): Promise<void> {
    await this.dbService.query(
      `INSERT INTO tbl_lead_assignment_history
       (lead_id, from_assignee_id, to_assignee_id, assigned_by_id, reason, assigned_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [leadId, fromAssigneeId, toAssigneeId, assignedBy, reason || null],
    );
  }

  /**
   * Reassigns leads to a specific telecaller and records the history.
   */
  async reassignLeads(leadIds: string[], toAssigneeId: string, assignedById: string) {
    try {
      // 1. Verify the user is a telecaller
      const userResult = await this.dbService.query(
        `SELECT id, role FROM ${this.dbService.usersTable} WHERE id = $1 AND LOWER(role) = 'telecaller'`,
        [toAssigneeId],
      );

      if (userResult.rows.length === 0) {
        throw new Error(`Active telecaller not found: ${toAssigneeId}`);
      }

      // 2. Get current assignees for history
      const leadsResult = await this.dbService.query(
        `SELECT id, assigned_to FROM tbl_leads WHERE id = ANY($1)`,
        [leadIds],
      );

      // 3. Update the leads
      await this.dbService.query(
        `UPDATE tbl_leads SET assigned_to = $1, updated_at = NOW() WHERE id = ANY($2)`,
        [toAssigneeId, leadIds],
      );

      // 4. Record history for each
      for (const lead of leadsResult.rows) {
        if (lead.assigned_to !== toAssigneeId) {
          await this.recordAssignmentHistory(
            lead.id,
            lead.assigned_to,
            toAssigneeId,
            assignedById,
            'Manual Reassignment'
          );
        }
      }

      return { success: true, message: `Successfully reassigned ${leadIds.length} leads` };
    } catch (error) {
      console.error('[LeadsService] Error reassigning leads:', error);
      throw error;
    }
  }

  /**
   * Retrieves all lead stages.
   */
  async getStages(): Promise<any[]> {
    try {
      const result = await this.dbService.query(
        `SELECT * FROM tbl_stages ORDER BY id ASC`
      );
      return result.rows;
    } catch (error) {
      console.error('[LeadsService] Error fetching stages:', error);
      throw error;
    }
  }

  /**
   * Retrieves leads based on filters.
   */
  async getLeads(filterStr?: string): Promise<{ data: any[], total: number }> {
    let limit = 10;
    let offset = 0;
    
    if (filterStr) {
      const parts = filterStr.split(',');
      for (const p of parts) {
        const [k, v] = p.split('=');
        if (k === 'limit' && v) limit = parseInt(v, 10);
        if (k === 'offset' && v) offset = parseInt(v, 10);
      }
    }
    
    try {
      const query = `SELECT * FROM tbl_leads WHERE is_deleted = false ORDER BY created_at DESC LIMIT $1 OFFSET $2`;
      const result = await this.dbService.query(query, [limit, offset]);
      
      const countResult = await this.dbService.query(`SELECT COUNT(*) FROM tbl_leads WHERE is_deleted = false`);
      const total = parseInt(countResult.rows[0].count, 10);
      
      return { data: result.rows, total };
    } catch (error) {
      console.error('[LeadsService] Error fetching leads:', error);
      throw error;
    }
  }

  /**
   * Retrieves a single lead by ID.
   */
  async getLeadById(id: string): Promise<any> {
    try {
      const result = await this.dbService.query(
        `SELECT * FROM tbl_leads WHERE id = $1 AND is_deleted = false`,
        [id]
      );
      if (result.rows.length === 0) {
        return null;
      }
      return result.rows[0];
    } catch (error) {
      console.error('[LeadsService] Error fetching lead by id:', error);
      throw error;
    }
  }

  /**
   * Retrieves follow-ups for a lead.
   */
  async getFollowUps(filterStr?: string): Promise<any[]> {
    let leadId = null;
    
    if (filterStr) {
      const parts = filterStr.split(',');
      for (const p of parts) {
        const [k, v] = p.split('=');
        if (k === 'leadId' && v) leadId = v;
      }
    }
    
    try {
      const query = `SELECT * FROM tbl_follow_ups ${leadId ? 'WHERE lead_id = $1' : ''} ORDER BY created_at DESC`;
      const params = leadId ? [leadId] : [];
      const result = await this.dbService.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('[LeadsService] Error fetching follow-ups:', error);
      throw error;
    }
  }
}
