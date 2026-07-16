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

  async getFollowUps(companyId: string, filterStr?: string) {
    let leadId = null;
    let limit = 50;

    if (filterStr) {
      const parts = filterStr.split(',');
      for (const p of parts) {
        const [k, v] = p.split('=');
        if (k === 'leadId' && v) leadId = v;
      }
    }

    let query = `SELECT * FROM ${TableConstants.FOLLOW_UPS} WHERE company_id = $1`;
    const params: any[] = [companyId];

    if (leadId) {
      params.push(leadId);
      query += ` AND lead_id = $2`;
    }

    query += ` ORDER BY scheduled_for ASC LIMIT $${params.length + 1}`;
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
