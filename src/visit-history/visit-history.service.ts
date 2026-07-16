import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { TableConstants } from '../utils/table-constants';
import { CreateVisitDto } from './dto/create-visit.dto';
import { ErrorService } from '../common/error/error.service';

@Injectable()
export class VisitHistoryService {
  constructor(
    private readonly dbService: DbService,
    private readonly errorService: ErrorService
  ) {}

  async createVisit(
    companyId: string,
    userId: string,
    dto: CreateVisitDto
  ) {
    // 1. Verify lead belongs to company
    const leadResult = await this.dbService.query(
      `SELECT id FROM ${TableConstants.LEADS} WHERE id = $1 AND company_id = $2 AND is_deleted = false`,
      [dto.leadId, companyId]
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
      [dto.leadId, companyId, dto.visitDate, dto.notes || null, userId]
    );

    return result.rows[0];
  }

  async getVisits(companyId: string, filterStr?: string) {
    let leadId = null;
    let limit = 50;
    
    if (filterStr) {
      const parts = filterStr.split(',');
      for (const p of parts) {
        const [k, v] = p.split('=');
        if (k === 'leadId' && v) leadId = v;
      }
    }

    let query = `SELECT * FROM ${TableConstants.VISIT_HISTORY} WHERE company_id = $1`;
    const params: any[] = [companyId];
    
    if (leadId) {
      params.push(leadId);
      query += ` AND lead_id = $2`;
    }

    query += ` ORDER BY visit_date DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.dbService.query(query, params);
    return result.rows;
  }
}
