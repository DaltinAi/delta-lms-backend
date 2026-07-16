import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { UsersService } from '../users/users.service';
import { TableConstants } from '../utils/table-constants';
import { ErrorService } from '../common/error/error.service';

@Injectable()
export class LeadsService {
  constructor(
    private readonly dbService: DbService,
    private readonly usersService: UsersService,
    private readonly errorService: ErrorService,
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
         FROM ${TableConstants.USERS} u
         LEFT JOIN ${TableConstants.LEADS} l ON l.assigned_to = u.id AND l.is_deleted = false
         WHERE u.role = 'telecaller'
           AND u.id = ANY($1)
         GROUP BY u.id
         ORDER BY COUNT(l.id) ASC
         LIMIT 1`,
        [activeTelecallers],
      );

      return result.rows.length > 0 ? result.rows[0].id : null;
    } catch (error) {
      console.error(
        '[LeadsService] Error in assignTeleCounsellorRoundRobin:',
        error,
      );
      // Never block lead creation due to assignment failure
      return null;
    }
  }

  async createLead(
    companyId: string,
    userId: string,
    leadData: import('./dto/create-lead.dto').CreateLeadDto,
  ) {
    return this.dbService.transaction(async (client) => {
      // Get default stage for the company
      const defaultStageResult = await client.query(
        `SELECT id FROM ${TableConstants.STAGES} WHERE company_id = $1 AND is_default = true LIMIT 1`,
        [companyId],
      );

      const defaultStageId =
        defaultStageResult.rows.length > 0
          ? defaultStageResult.rows[0].id
          : null;

      // Assign to a telecaller
      const assignedTo = await this.assignTeleCounsellorRoundRobin();

      const insertResult = await client.query(
        `INSERT INTO ${TableConstants.LEADS} 
         (company_id, created_by, current_stage_id, first_name, last_name, phone, email, data, assigned_to)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          companyId,
          userId,
          defaultStageId,
          leadData.firstName,
          leadData.lastName || null,
          leadData.phone,
          leadData.email || null,
          leadData.data || {},
          assignedTo,
        ],
      );

      const newLead = insertResult.rows[0];

      // Record stage history
      if (defaultStageId) {
        await client.query(
          `INSERT INTO ${TableConstants.LEAD_STAGE_HISTORY}
           (lead_id, company_id, to_stage_id, changed_by, remark)
           VALUES ($1, $2, $3, $4, $5)`,
          [newLead.id, companyId, defaultStageId, userId, 'Lead Created'],
        );
      }

      // Record assignment history if assigned
      if (assignedTo) {
        await client.query(
          `INSERT INTO ${TableConstants.LEAD_STAGE_HISTORY}
           (lead_id, company_id, changed_by, remark)
           VALUES ($1, $2, $3, $4)`,
          [newLead.id, companyId, assignedTo, 'Auto-assigned via Round Robin'],
        );
      }

      return newLead;
    });
  }

  async updateLead(
    id: string,
    companyId: string,
    updateData: import('./dto/update-lead.dto').UpdateLeadDto,
  ) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updateData.firstName !== undefined) {
      fields.push(`first_name = $${idx++}`);
      values.push(updateData.firstName);
    }
    if (updateData.lastName !== undefined) {
      fields.push(`last_name = $${idx++}`);
      values.push(updateData.lastName);
    }
    if (updateData.phone !== undefined) {
      fields.push(`phone = $${idx++}`);
      values.push(updateData.phone);
    }
    if (updateData.email !== undefined) {
      fields.push(`email = $${idx++}`);
      values.push(updateData.email);
    }
    if (updateData.data !== undefined) {
      fields.push(`data = $${idx++}`);
      values.push(updateData.data);
    }

    if (fields.length === 0) {
      return this.getLeadById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id, companyId);

    const query = `
      UPDATE ${TableConstants.LEADS}
      SET ${fields.join(', ')}
      WHERE id = $${idx} AND company_id = $${idx + 1} AND is_deleted = false
      RETURNING *
    `;

    const result = await this.dbService.query(query, values);
    if (result.rows.length === 0) {
      return null;
    }
    return result.rows[0];
  }

  async updateLeadStage(
    id: string,
    companyId: string,
    toStageId: string,
    userId: string,
    remark?: string,
  ) {
    return this.dbService.transaction(async (client) => {
      // 1. Get the current lead to verify it exists and belongs to the company
      const leadResult = await client.query(
        `SELECT id, current_stage_id FROM ${TableConstants.LEADS} WHERE id = $1 AND company_id = $2 AND is_deleted = false FOR UPDATE`,
        [id, companyId],
      );

      if (leadResult.rows.length === 0) {
        throw new Error('Lead not found or unauthorized');
      }

      const lead = leadResult.rows[0];

      // 2. Prevent redundant updates
      if (lead.current_stage_id === toStageId) {
        return { message: 'Lead is already in this stage' };
      }

      // 3. Update the lead's current stage
      await client.query(
        `UPDATE ${TableConstants.LEADS} SET current_stage_id = $1, updated_at = NOW() WHERE id = $2`,
        [toStageId, id],
      );

      // 4. Log the stage history
      await client.query(
        `INSERT INTO ${TableConstants.LEAD_STAGE_HISTORY}
         (lead_id, company_id, from_stage_id, to_stage_id, changed_by, remark)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          companyId,
          lead.current_stage_id,
          toStageId,
          userId,
          remark || null,
        ],
      );

      return { success: true, message: 'Stage updated successfully' };
    });
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
      `INSERT INTO ${TableConstants.LEAD_STAGE_HISTORY}
       (lead_id, from_stage_id, to_stage_id, changed_by, remark, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [leadId, fromAssigneeId, toAssigneeId, assignedBy, reason || null],
    );
  }

  /**
   * Reassigns leads to a specific telecaller and records the history.
   */
  async reassignLeads(
    leadIds: string[],
    toAssigneeId: string,
    assignedById: string,
  ) {
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
        `SELECT id, assigned_to FROM ${TableConstants.LEADS} WHERE id = ANY($1)`,
        [leadIds],
      );

      // 3. Update the leads
      await this.dbService.query(
        `UPDATE ${TableConstants.LEADS} SET assigned_to = $1, updated_at = NOW() WHERE id = ANY($2)`,
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
            'Manual Reassignment',
          );
        }
      }

      return {
        success: true,
        message: `Successfully reassigned ${leadIds.length} leads`,
      };
    } catch (error) {
      console.error('[LeadsService] Error reassigning leads:', error);
      throw error;
    }
  }

  /**
   * Retrieves leads based on filters.
   */
  async getLeads(filterStr?: string): Promise<{ data: any[]; total: number }> {
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
      const query = `SELECT * FROM ${TableConstants.LEADS} WHERE is_deleted = false ORDER BY created_at DESC LIMIT $1 OFFSET $2`;
      const result = await this.dbService.query(query, [limit, offset]);

      const countResult = await this.dbService.query(
        `SELECT COUNT(*) FROM ${TableConstants.LEADS} WHERE is_deleted = false`,
      );
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
        `SELECT * FROM ${TableConstants.LEADS} WHERE id = $1 AND is_deleted = false`,
        [id],
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
}
