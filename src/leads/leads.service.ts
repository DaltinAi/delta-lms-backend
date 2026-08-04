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

      // Assign to specified counselor/telecaller or fallback to round-robin
      const assignedTo =
        (leadData as any).assignedTo ||
        (leadData as any).assigned_to ||
        leadData.data?.counselorId ||
        (await this.assignTeleCounsellorRoundRobin());

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
    userId: string,
  ) {
    return this.dbService.transaction(async (client) => {
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
      const targetAssignedTo =
        (updateData as any).assignedTo ||
        (updateData as any).assigned_to ||
        updateData.data?.counselorId;
      if (targetAssignedTo !== undefined && targetAssignedTo !== null) {
        fields.push(`assigned_to = $${idx++}`);
        values.push(targetAssignedTo);
      }

      let updatedLead = null;

      if (fields.length > 0) {
        fields.push(`updated_at = NOW()`);
        values.push(id, companyId);

        const query = `
          UPDATE ${TableConstants.LEADS}
          SET ${fields.join(', ')}
          WHERE id = $${idx} AND company_id = $${idx + 1} AND is_deleted = false
          RETURNING *
        `;

        const result = await client.query(query, values);
        if (result.rows.length === 0) {
          return null;
        }
        updatedLead = result.rows[0];
      } else {
        const getResult = await client.query(
          `SELECT * FROM ${TableConstants.LEADS} WHERE id = $1 AND company_id = $2 AND is_deleted = false`,
          [id, companyId],
        );
        if (getResult.rows.length === 0) {
          return null;
        }
        updatedLead = getResult.rows[0];
      }

      if (updateData.remark) {
        await client.query(
          `INSERT INTO ${TableConstants.LEAD_STAGE_HISTORY}
           (lead_id, company_id, changed_by, remark)
           VALUES ($1, $2, $3, $4)`,
          [id, companyId, userId, updateData.remark],
        );
      }

      return updatedLead;
    });
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

      // Resolve stage key if toStageId is not a UUID
      let targetStageId = toStageId;
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(toStageId);
      if (!isUuid) {
        const stageRes = await client.query(
          `SELECT id FROM ${TableConstants.STAGES} WHERE company_id = $1 AND (LOWER(key) = $2 OR LOWER(name) ILIKE $3) LIMIT 1`,
          [companyId, toStageId.toLowerCase(), `%${toStageId.toLowerCase()}%`],
        );
        if (stageRes.rows.length > 0) {
          targetStageId = stageRes.rows[0].id;
        }
      }

      // 2. Prevent redundant updates
      if (lead.current_stage_id === targetStageId) {
        return { message: 'Lead is already in this stage' };
      }

      // 3. Update the lead's current stage
      await client.query(
        `UPDATE ${TableConstants.LEADS} SET current_stage_id = $1, updated_at = NOW() WHERE id = $2`,
        [targetStageId, id],
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
          targetStageId,
          userId,
          remark || null,
        ],
      );

      return { success: true, message: 'Stage updated successfully' };
    });
  }

  /**
   * Books / Enrolls a lead by updating data payload with booking information
   * and setting current stage to Enrolled.
   */
  async bookLead(
    id: string,
    companyId: string,
    userId: string,
    bookingData: any,
  ) {
    return this.dbService.transaction(async (client) => {
      // 1. Get current lead
      const leadResult = await client.query(
        `SELECT * FROM ${TableConstants.LEADS} WHERE id = $1 AND company_id = $2 AND is_deleted = false FOR UPDATE`,
        [id, companyId],
      );

      if (leadResult.rows.length === 0) {
        throw new Error('Lead not found or unauthorized');
      }

      const lead = leadResult.rows[0];
      const existingData = lead.data || {};
      const updatedData = {
        ...existingData,
        ...bookingData,
        bookedAt: new Date().toISOString(),
        bookedBy: userId,
      };

      // 2. Find 'enrolled' or 'appointment' stage ID
      const stageRes = await client.query(
        `SELECT id FROM ${TableConstants.STAGES} WHERE company_id = $1 AND (LOWER(key) IN ('enrolled', 'appointment') OR LOWER(name) ILIKE '%enrolled%') LIMIT 1`,
        [companyId],
      );
      const enrolledStageId = stageRes.rows.length > 0 ? stageRes.rows[0].id : lead.current_stage_id;

      // 3. Update lead data and stage
      const updateResult = await client.query(
        `UPDATE ${TableConstants.LEADS}
         SET data = $1, current_stage_id = $2, updated_at = NOW()
         WHERE id = $3 AND company_id = $4
         RETURNING *`,
        [updatedData, enrolledStageId, id, companyId],
      );

      // 4. Log stage history
      await client.query(
        `INSERT INTO ${TableConstants.LEAD_STAGE_HISTORY}
         (lead_id, company_id, from_stage_id, to_stage_id, changed_by, remark)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          companyId,
          lead.current_stage_id,
          enrolledStageId,
          userId,
          'Lead Booked / Enrolled by Counsellor',
        ],
      );

      return updateResult.rows[0];
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
   * Checks if a lead with the given phone number already exists in the company.
   * Scoped to the caller's company to prevent cross-company data leaks.
   */
  async checkPhoneExists(
    companyId: string,
    phoneLast10: string,
  ): Promise<{ exists: boolean; leadId?: string; name?: string; lead?: any }> {
    try {
      const result = await this.dbService.query(
        `SELECT * FROM ${TableConstants.LEADS}
         WHERE company_id = $1 AND RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = $2 AND is_deleted = false LIMIT 1`,
        [companyId, phoneLast10],
      );

      if (result.rows.length === 0) {
        return { exists: false };
      }

      const lead = result.rows[0];
      return {
        exists: true,
        leadId: lead.id,
        name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
        lead,
      };
    } catch (error) {
      console.error('[LeadsService] Error checking phone existence:', error);
      throw error;
    }
  }

  /**
   * Retrieves leads based on filters and search.
   */
  async getLeads(
    filterStr?: string,
    searchStr?: string,
    tabStr?: string,
  ): Promise<{ data: any[]; total: number }> {
    let limit = 10;
    let offset = 0;
    const filterClauses: string[] = ['l.is_deleted = false'];
    const values: any[] = [];
    let idx = 1;
    let joinStages = false;
    const joinFollowUps = false;

    if (filterStr) {
      const parts = filterStr.split(',');
      for (const p of parts) {
        const [k, v] = p.split('=');
        if (!v) continue;
        const val = decodeURIComponent(v);

        if (k === 'limit') limit = parseInt(val, 10);
        else if (k === 'offset') offset = parseInt(val, 10);
        else if (k === 'stageId') {
          filterClauses.push(`l.current_stage_id = $${idx++}`);
          values.push(val);
        } else if (k === 'stageType') {
          filterClauses.push(`s.key = $${idx++}`);
          values.push(val);
          joinStages = true;
        } else if (k === 'startDate') {
          filterClauses.push(`l.created_at >= $${idx++}`);
          values.push(val);
        } else if (k === 'endDate') {
          filterClauses.push(`l.created_at <= $${idx++}`);
          values.push(val);
        } else if (k === 'source') {
          filterClauses.push(`l.data->>'source' = $${idx++}`);
          values.push(val);
        } else if (k === 'country' || k === 'interestedCountry') {
          filterClauses.push(`l.data->>'country' = $${idx++}`);
          values.push(val);
        }
      }
    }

    if (tabStr) {
      joinStages = true;
      const tabVal = tabStr.toLowerCase();
      if (tabVal === 'new') {
        filterClauses.push(`(LOWER(s.key) IN ('new', 'walk_in') OR LOWER(s.name) ILIKE '%new%')`);
      } else if (tabVal === 'interested') {
        filterClauses.push(`(LOWER(s.key) = 'interested' OR LOWER(s.name) ILIKE '%interested%')`);
      } else if (tabVal === 'booked' || tabVal === 'enrolled') {
        filterClauses.push(`(LOWER(s.key) IN ('appointment', 'enrolled', 'appointment_booked') OR LOWER(s.name) ILIKE '%booked%' OR LOWER(s.name) ILIKE '%enrolled%')`);
      } else if (tabVal === 'cold') {
        filterClauses.push(`(LOWER(s.key) IN ('not_interested', 'cold') OR LOWER(s.name) ILIKE '%cold%' OR LOWER(s.name) ILIKE '%not interested%')`);
      }
    }

    if (searchStr) {
      const decodedSearch = decodeURIComponent(searchStr);
      filterClauses.push(
        `(l.first_name ILIKE $${idx} OR l.last_name ILIKE $${idx} OR l.phone ILIKE $${idx} OR l.email ILIKE $${idx})`,
      );
      values.push(`%${decodedSearch}%`);
      idx++;
    }

    try {
      let query = `
        SELECT l.*, COUNT(l.id) OVER() AS total_count
        FROM ${TableConstants.LEADS} l
      `;
      if (joinStages) {
        query += ` LEFT JOIN ${TableConstants.STAGES} s ON l.current_stage_id = s.id`;
      }
      if (joinFollowUps) {
        query += ` LEFT JOIN ${TableConstants.FOLLOW_UPS} f ON f.lead_id = l.id`;
      }

      query += ` WHERE ${filterClauses.join(' AND ')}
        ORDER BY l.created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}
      `;

      values.push(limit, offset);

      const result = await this.dbService.query(query, values);

      const total =
        result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;

      // Strip total_count from returned rows so it doesn't leak into the response
      const data = result.rows.map(({ total_count, ...row }) => row);

      return { data, total };
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
