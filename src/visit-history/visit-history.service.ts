import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { TableConstants } from '../utils/table-constants';
import { CreateVisitDto } from './dto/create-visit.dto';
import { ErrorService } from '../common/error/error.service';

@Injectable()
export class VisitHistoryService {
  constructor(
    private readonly dbService: DbService,
    private readonly errorService: ErrorService,
  ) {}

  async createVisit(companyId: string, userId: string, dto: CreateVisitDto) {
    // 1. Verify lead belongs to company
    const leadResult = await this.dbService.query(
      `SELECT id FROM ${TableConstants.LEADS} WHERE id = $1 AND company_id = $2 AND is_deleted = false`,
      [dto.leadId, companyId],
    );

    if (leadResult.rows.length === 0) {
      this.errorService.errorThrower(404, { message: 'Lead not found' });
    }

    // 2. Insert visit
    const result = await this.dbService.query(
      `INSERT INTO ${TableConstants.VISIT_HISTORY}
       (lead_id, company_id, visit_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [dto.leadId, companyId, dto.visitDate, dto.notes || null, userId],
    );

    return result.rows[0];
  }

  async getVisits(companyId: string, filterStr?: string) {
    let leadId = null;
    const limit = 50;

    if (filterStr) {
      const parts = filterStr.split(',');
      for (const p of parts) {
        const [k, v] = p.split('=');
        if (k === 'leadId' && v) leadId = v;
      }
    }

    let query = `
      SELECT 
        v.*, 
        l.first_name as "leadFirstName", 
        l.last_name as "leadLastName", 
        l.phone as "leadPhone",
        l.data as "leadData",
        u.first_name as "counselorFirstName",
        u.last_name as "counselorLastName"
      FROM ${TableConstants.VISIT_HISTORY} v
      LEFT JOIN ${TableConstants.LEADS} l ON v.lead_id = l.id
      LEFT JOIN ${TableConstants.USERS} u ON (
        CASE WHEN l.data->>'counselorId' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' 
        THEN (l.data->>'counselorId')::uuid 
        ELSE NULL END
      ) = u.id
      WHERE v.company_id = $1
    `;
    const params: any[] = [companyId];

    if (leadId) {
      params.push(leadId);
      query += ` AND v.lead_id = $2`;
    }

    query += ` ORDER BY v.visit_date DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.dbService.query(query, params);
    return result.rows;
  }
}
