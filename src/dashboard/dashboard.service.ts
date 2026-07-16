import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { TableConstants } from '../utils/table-constants';
import { ErrorService } from '../common/error/error.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly dbService: DbService,
    private readonly errorService: ErrorService
  ) {}

  async getStats(
    companyId: string,
    userId: string,
    role: string,
    startDate?: string,
    endDate?: string
  ) {
    const isAdmin = role === 'admin';
    let baseConditions = 'l.company_id = $1 AND l.is_deleted = false';
    const queryParams: any[] = [companyId];
    let paramIndex = 2;

    if (startDate) {
      baseConditions += ` AND l.created_at >= $${paramIndex}`;
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      baseConditions += ` AND l.created_at <= $${paramIndex}`;
      queryParams.push(endDate + 'T23:59:59.999Z');
      paramIndex++;
    }

    let roleCondition = '';
    if (!isAdmin) {
      if (role === 'receptionist') {
        roleCondition = ` AND (l.created_by = $${paramIndex} OR s.key ILIKE '%walk%')`;
      } else {
        roleCondition = ` AND l.created_by = $${paramIndex}`;
      }
      queryParams.push(userId);
    }

    // Get total leads
    const totalLeadsQuery = `
      SELECT COUNT(*) as count
      FROM ${TableConstants.LEADS} l
      LEFT JOIN ${TableConstants.STAGES} s ON l.current_stage_id = s.id
      WHERE ${baseConditions}${roleCondition}
    `;
    const totalResult = await this.dbService.query(totalLeadsQuery, queryParams);
    const totalLeads = parseInt(totalResult.rows[0].count, 10);

    // Get country breakdown
    const countryQuery = `
      SELECT 
        country_item as country,
        COUNT(*) as count
      FROM ${TableConstants.LEADS} l
      LEFT JOIN ${TableConstants.STAGES} s ON l.current_stage_id = s.id,
      LATERAL (
        SELECT jsonb_array_elements_text(
          CASE 
            WHEN jsonb_typeof(l.data->'countries_interested') = 'array' THEN l.data->'countries_interested'
            ELSE '[]'::jsonb
          END
        ) as country_item
      ) countries
      WHERE ${baseConditions}${roleCondition}
      GROUP BY country_item
      ORDER BY count DESC
    `;
    const countryResult = await this.dbService.query(countryQuery, queryParams);

    let countryBreakdown = countryResult.rows.map(r => ({
      country: r.country || 'Unknown',
      count: parseInt(r.count, 10)
    }));

    if (countryBreakdown.length > 4) {
      const otherCount = countryBreakdown.slice(4).reduce((sum, item) => sum + item.count, 0);
      countryBreakdown = countryBreakdown.slice(0, 4);
      if (otherCount > 0) {
        countryBreakdown.push({ country: 'Other', count: otherCount });
      }
    }

    // Get branch breakdown
    const branchQuery = `
      SELECT 
        LOWER(TRIM(l.data->>'branch')) as branch_key,
        l.data->>'branch' as branch,
        COUNT(*) as count
      FROM ${TableConstants.LEADS} l
      LEFT JOIN ${TableConstants.STAGES} s ON l.current_stage_id = s.id
      WHERE ${baseConditions}${roleCondition}
        AND l.data->>'branch' IS NOT NULL
        AND TRIM(l.data->>'branch') != ''
      GROUP BY LOWER(TRIM(l.data->>'branch')), l.data->>'branch'
      ORDER BY count DESC
    `;
    const branchResult = await this.dbService.query(branchQuery, queryParams);

    const branchMap = new Map<string, { name: string; count: number }>();
    for (const row of branchResult.rows) {
      const key = row.branch_key?.toLowerCase() || 'unknown';
      const displayName = row.branch || 'Unknown';
      const count = parseInt(row.count, 10);

      if (branchMap.has(key)) {
        branchMap.get(key)!.count += count;
      } else {
        const formattedName = displayName.charAt(0).toUpperCase() + displayName.slice(1).toLowerCase();
        branchMap.set(key, { name: formattedName, count });
      }
    }

    const branchBreakdown = Array.from(branchMap.values())
      .map(item => ({ branch: item.name, count: item.count }))
      .sort((a, b) => b.count - a.count);

    return {
      countryBreakdown,
      branchBreakdown,
      totalLeads
    };
  }
}
