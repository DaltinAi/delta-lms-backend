import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { TableConstants } from '../utils/table-constants';
import { CreateFollowUpDto } from './dto/create-follow-up.dto';
import { ErrorService } from '../common/error/error.service';

@Injectable()
export class FollowUpsService {
  constructor(
    private readonly dbService: DbService,
    private readonly errorService: ErrorService,
  ) {}

  async createFollowUp(
    companyId: string,
    userId: string,
    dto: CreateFollowUpDto,
  ) {
    // 1. Verify lead belongs to company
    const leadResult = await this.dbService.query(
      `SELECT id FROM ${TableConstants.LEADS} WHERE id = $1 AND company_id = $2 AND is_deleted = false`,
      [dto.leadId, companyId],
    );

    if (leadResult.rows.length === 0) {
      this.errorService.errorThrower(404, { message: 'Lead not found' });
    }

    // 2. Insert follow-up
    const result = await this.dbService.query(
      `INSERT INTO ${TableConstants.FOLLOW_UPS}
       (lead_id, company_id, scheduled_for, mode, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        dto.leadId,
        companyId,
        dto.scheduledFor,
        dto.mode,
        dto.note || null,
        userId,
      ],
    );

    return result.rows[0];
  }

  async getFollowUps(
    companyId: string,
    filterStr?: string,
    requesterId?: string,
    requesterRole?: string,
  ) {
    let leadId: string | null = null;
    let userId: string | null = null;
    let startDate: string | null = null;
    let endDate: string | null = null;
    let limit = 50;

    if (filterStr) {
      const parts = filterStr.split(',');
      for (const p of parts) {
        const [k, v] = p.split('=');
        if (!k || !v) continue;
        if (k === 'leadId') leadId = v;
        if (k === 'userId') userId = v;
        if (k === 'startDate') startDate = v;
        if (k === 'endDate') endDate = v;
        if (k === 'limit') limit = parseInt(v, 10);
      }
    }

    const params: any[] = [companyId];
    let paramIndex = 2;

    let query = `SELECT * FROM ${TableConstants.FOLLOW_UPS} WHERE company_id = $1`;

    if (requesterId && requesterRole && requesterRole.toLowerCase() !== 'admin') {
      query += ` AND created_by = $${paramIndex++}`;
      params.push(requesterId);
    } else if (userId) {
      query += ` AND created_by = $${paramIndex++}`;
      params.push(userId);
    }

    if (leadId) {
      query += ` AND lead_id = $${paramIndex++}`;
      params.push(leadId);
    }

    if (startDate) {
      query += ` AND scheduled_for >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND scheduled_for <= $${paramIndex++}`;
      params.push(endDate + 'T23:59:59.999Z');
    }

    query += ` ORDER BY scheduled_for ASC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await this.dbService.query(query, params);
    return result.rows;
  }

  async completeFollowUp(id: string, companyId: string) {
    const result = await this.dbService.query(
      `UPDATE ${TableConstants.FOLLOW_UPS}
       SET status = 'completed', completed_at = NOW()
       WHERE id = $1 AND company_id = $2
       RETURNING *`,
      [id, companyId],
    );

    if (result.rows.length === 0) {
      this.errorService.errorThrower(404, { message: 'Follow-up not found' });
    }

    return result.rows[0];
  }
}
