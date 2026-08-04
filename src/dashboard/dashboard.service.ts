import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { TableConstants } from '../utils/table-constants';
import { ErrorService } from '../common/error/error.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly dbService: DbService,
    private readonly errorService: ErrorService,
  ) {}

  async getStats(
    companyId: string,
    userId: string,
    role: string,
    startDate?: string,
    endDate?: string,
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
        roleCondition = ` AND (l.created_by = $${paramIndex} OR l.assigned_to = $${paramIndex})`;
      }
      queryParams.push(userId);
    }

    // Get total leads
    const totalLeadsQuery = `
      SELECT 
        COUNT(*) as count,
        SUM(CASE WHEN LOWER(s.key) IN ('new', 'walk_in') OR LOWER(s.name) ILIKE '%new%' THEN 1 ELSE 0 END)::int as new_leads,
        SUM(CASE WHEN LOWER(s.key) = 'pending' THEN 1 ELSE 0 END)::int as pending_leads,
        SUM(CASE WHEN LOWER(s.key) = 'interested' OR LOWER(s.name) ILIKE '%interested%' THEN 1 ELSE 0 END)::int as interested_leads,
        SUM(CASE WHEN LOWER(s.key) IN ('not_interested', 'cold') OR LOWER(s.name) ILIKE '%cold%' OR LOWER(s.name) ILIKE '%not interested%' THEN 1 ELSE 0 END)::int as cold_leads,
        SUM(CASE WHEN LOWER(s.key) IN ('enrolled', 'appointment', 'appointment_booked') OR LOWER(s.name) ILIKE '%booked%' OR LOWER(s.name) ILIKE '%enrolled%' THEN 1 ELSE 0 END)::int as converted_leads
      FROM ${TableConstants.LEADS} l
      LEFT JOIN ${TableConstants.STAGES} s ON l.current_stage_id = s.id
      WHERE ${baseConditions}${roleCondition}
    `;
    const totalResult = await this.dbService.query(
      totalLeadsQuery,
      queryParams,
    );
    const totalRow = totalResult.rows[0];
    const totalLeads = parseInt(totalRow.count, 10);
    const newLeads = parseInt(totalRow.new_leads || '0', 10);
    const pendingLeads = parseInt(totalRow.pending_leads || '0', 10);
    const interestedLeads = parseInt(totalRow.interested_leads || '0', 10);
    const coldLeads = parseInt(totalRow.cold_leads || '0', 10);
    const convertedLeads = parseInt(totalRow.converted_leads || '0', 10);

    // Get today's follow-ups for telecaller
    const followUpsQuery = `
      SELECT COUNT(*)::int as count
      FROM ${TableConstants.FOLLOW_UPS} fu
      WHERE fu.company_id = $1 AND fu.created_by = $2 AND fu.status = 'pending'
        AND fu.follow_up_date = CURRENT_DATE
    `;
    const followUpsResult = await this.dbService.query(followUpsQuery, [
      companyId,
      userId,
    ]);
    const todayFollowUps = parseInt(followUpsResult.rows[0].count, 10);

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

    let countryBreakdown = countryResult.rows.map((r) => ({
      country: r.country || 'Unknown',
      count: parseInt(r.count, 10),
    }));

    if (countryBreakdown.length > 4) {
      const otherCount = countryBreakdown
        .slice(4)
        .reduce((sum, item) => sum + item.count, 0);
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
        const formattedName =
          displayName.charAt(0).toUpperCase() +
          displayName.slice(1).toLowerCase();
        branchMap.set(key, { name: formattedName, count });
      }
    }

    const branchBreakdown = Array.from(branchMap.values())
      .map((item) => ({ branch: item.name, count: item.count }))
      .sort((a, b) => b.count - a.count);

    return {
      countryBreakdown,
      branchBreakdown,
      totalLeads,
      newLeads,
      pendingLeads,
      interestedLeads,
      coldLeads,
      convertedLeads,
      todayFollowUps,
      appointmentBooked: convertedLeads,
    };
  }

  async getReceptionistStats(companyId: string) {
    try {
      // 1. Today's Appointments (a.appointment_date = CURRENT_DATE)
      const todayApptResult = await this.dbService.query(
        `SELECT COUNT(*)::int as count FROM ${TableConstants.APPOINTMENTS} 
         WHERE company_id = $1 AND is_deleted = false AND appointment_date = CURRENT_DATE`,
        [companyId]
      );
      const todayAppointments = todayApptResult.rows[0].count;

      // 2. Upcoming 7 Days Appointments
      const upcomingApptResult = await this.dbService.query(
        `SELECT COUNT(*)::int as count FROM ${TableConstants.APPOINTMENTS} 
         WHERE company_id = $1 AND is_deleted = false AND appointment_date > CURRENT_DATE AND appointment_date <= CURRENT_DATE + INTERVAL '7 days'`,
        [companyId]
      );
      const upcomingAppointments = upcomingApptResult.rows[0].count;

      // 3. Today's Walk-ins (v.visit_date = CURRENT_DATE)
      const todayWalkinsResult = await this.dbService.query(
        `SELECT COUNT(*)::int as count FROM ${TableConstants.VISIT_HISTORY} 
         WHERE company_id = $1 AND DATE(visit_date) = CURRENT_DATE`,
        [companyId]
      );
      const todayWalkins = todayWalkinsResult.rows[0].count;

      // 4. Enrolled Today (leads in stage 'enrolled' or created today in 'enrolled' stage)
      const enrolledTodayResult = await this.dbService.query(
        `SELECT COUNT(*)::int as count FROM ${TableConstants.LEADS} l
         JOIN ${TableConstants.STAGES} s ON l.current_stage_id = s.id
         WHERE l.company_id = $1 AND l.is_deleted = false 
           AND LOWER(s.key) = 'enrolled' AND DATE(l.updated_at) = CURRENT_DATE`,
        [companyId]
      );
      const enrolledToday = enrolledTodayResult.rows[0].count;

      // 5. Country breakdown (countries_interested or countries in l.data)
      const countryResult = await this.dbService.query(
        `SELECT 
           country_item as country,
           COUNT(*) as count
         FROM ${TableConstants.LEADS} l,
         LATERAL (
           SELECT jsonb_array_elements_text(
             CASE 
               WHEN jsonb_typeof(l.data->'countries') = 'array' THEN l.data->'countries'
               WHEN jsonb_typeof(l.data->'countries_interested') = 'array' THEN l.data->'countries_interested'
               ELSE '[]'::jsonb
             END
           ) as country_item
         ) countries
         WHERE l.company_id = $1 AND l.is_deleted = false
         GROUP BY country_item
         ORDER BY count DESC`,
        [companyId]
      );
      const countries = countryResult.rows.map(r => ({
        name: r.country,
        count: parseInt(r.count, 10)
      }));

      // 6. Visa types breakdown (from l.data->>'visaType')
      const visaResult = await this.dbService.query(
        `SELECT 
           COALESCE(l.data->>'visaType', 'Unknown') as type,
           COUNT(*) as count
         FROM ${TableConstants.LEADS} l
         WHERE l.company_id = $1 AND l.is_deleted = false
         GROUP BY l.data->>'visaType'
         ORDER BY count DESC`,
        [companyId]
      );
      const visaTypes = visaResult.rows.map(r => ({
        type: r.type,
        count: parseInt(r.count, 10)
      }));

      // 7. Source breakdown (from l.data->>'sourceType')
      const sourceResult = await this.dbService.query(
        `SELECT 
           COALESCE(l.data->>'sourceType', 'Unknown') as name,
           COUNT(*) as count
         FROM ${TableConstants.LEADS} l
         WHERE l.company_id = $1 AND l.is_deleted = false
         GROUP BY l.data->>'sourceType'
         ORDER BY count DESC`,
        [companyId]
      );
      const sources = sourceResult.rows.map(r => ({
        name: r.name,
        count: parseInt(r.count, 10)
      }));

      return {
        stats: {
          todayAppointments,
          upcomingAppointments,
          todayWalkins,
          enrolledToday,
        },
        countries,
        visaTypes,
        sources,
      };
    } catch (error) {
      console.error('[DashboardService] Error fetching receptionist stats:', error);
      throw error;
    }
  }
}
