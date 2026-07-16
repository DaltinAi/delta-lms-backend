import { Injectable } from '@nestjs/common';
import { DbService } from '../../db/db.service';
import { getCallMetrics, getHourlyCallActivity } from '../../utils/ivr-firebase';

export interface AnalyticsParams {
  startDate: string;
  endDate: string;
  targetUserId?: string;
  requesterId?: string;
  companyId: string;
}

import { TableConstants } from '../../utils/table-constants';
import { ErrorService } from '../../common/error/error.service';

@Injectable()
export class TelecallerAnalyticsStrategy {
  constructor(
    private readonly dbService: DbService,
    private readonly errorService: ErrorService
  ) {}

  async getAnalytics(params: AnalyticsParams): Promise<any> {
    try {
      const finalStartDate = new Date(params.startDate);
      const finalEndDate = new Date(params.endDate);

      // Target telecaller is either the specified one or the requester themselves
      const targetUserId = params.targetUserId ?? params.requesterId;
      const companyId = params.companyId;

      // Leads-based WHERE: scoped to user and date range
      const leadsWhere = `l.is_deleted = false AND l.company_id = $1 AND l.assigned_to = $2 AND l.created_at >= $3 AND l.created_at <= $4`;
      const leadsParams = [companyId, targetUserId, finalStartDate, finalEndDate];

      // Run all queries in parallel
      const [
        stageCountsRes,
        untouchedRes,
        followUpsRes,
        callMetrics,
        hourlyActivity,
      ] = await Promise.all([
        // 1. Lead counts by stage type in range
        this.dbService.query(
          `SELECT
             COUNT(*)::int                                                              AS "totalLeads",
             SUM(CASE WHEN LOWER(s.stage_type) = 'new'        THEN 1 ELSE 0 END)::int AS "newLeads",
             SUM(CASE WHEN LOWER(s.stage_type) = 'pending'    THEN 1 ELSE 0 END)::int AS "pendingLeads",
             SUM(CASE WHEN LOWER(s.stage_type) = 'cold'       THEN 1 ELSE 0 END)::int AS "coldLeads",
             SUM(CASE WHEN LOWER(s.stage_type) = 'interested' THEN 1 ELSE 0 END)::int AS "interestedLeads",
             SUM(CASE WHEN LOWER(s.stage_type) = 'enrolled'   THEN 1 ELSE 0 END)::int AS "enrolledLeads"
           FROM ${TableConstants.LEADS} l
           LEFT JOIN ${TableConstants.STAGES} s ON s.id = l.current_stage_id
           WHERE ${leadsWhere}`,
          leadsParams,
        ),

        // 2. Untouched leads in range
        this.dbService.query(
          `SELECT COUNT(*)::int AS "untouchedLeads"
               FROM ${TableConstants.LEADS} l
               WHERE l.is_deleted = false
                 AND l.company_id = $1
                 AND l.assigned_to = $2
                 AND l.created_at >= $3
                 AND l.created_at <= $4
                 AND NOT EXISTS (
                   SELECT 1 FROM ${TableConstants.LEAD_STAGE_HISTORY} h
                   WHERE h.lead_id = l.id
                     AND h.created_at >= $3
                     AND h.created_at <= $4
                     AND h.id != (
                       SELECT id FROM ${TableConstants.LEAD_STAGE_HISTORY}
                       WHERE lead_id = l.id ORDER BY created_at ASC LIMIT 1
                     )
                 )`,
          leadsParams,
        ),

        // 3. Follow-ups metrics
        this.dbService.query(
          `SELECT
             COUNT(*)::int AS "totalFollowUpsCreated",
             SUM(CASE WHEN fu.completed_at >= $3 AND fu.completed_at <= $4 THEN 1 ELSE 0 END)::int AS "completedFollowUps"
           FROM ${TableConstants.FOLLOW_UPS} fu
           WHERE fu.company_id = $1 AND fu.created_by = $2 AND fu.created_at >= $3 AND fu.created_at <= $4`,
          [companyId, targetUserId, finalStartDate, finalEndDate],
        ),

        // 4. Call Metrics from Firebase
        getCallMetrics(
          companyId,
          finalStartDate,
          finalEndDate,
          targetUserId,
        ),

        // 5. Hourly Activity from Firebase
        getHourlyCallActivity(
          companyId,
          finalStartDate,
          finalEndDate,
          targetUserId,
        ),
      ]);

      const stageCounts = stageCountsRes.rows[0] ?? {};
      const followUps = followUpsRes.rows[0] ?? {};

      const totalLeadsInRange = stageCounts.totalLeads ?? 0;
      const enrolledInRange = stageCounts.enrolledLeads ?? 0;

      // Range conversion ratio: Enrolled in range / Leads created in range
      const rangeConversionRatio =
        totalLeadsInRange > 0
          ? parseFloat(((enrolledInRange / totalLeadsInRange) * 100).toFixed(1))
          : 0;

      const followUpsCreated = followUps.totalFollowUpsCreated ?? 0;
      const followUpsCompleted = followUps.completedFollowUps ?? 0;
      const followUpCompletionRate =
        followUpsCreated > 0
          ? parseFloat(((followUpsCompleted / followUpsCreated) * 100).toFixed(1))
          : 0;

      return {
        status: 200,
        dateRange: { startDate: finalStartDate, endDate: finalEndDate },

        overview: {
          connectedCalls: callMetrics.connectedCalls,
          totalAttempts: callMetrics.totalAttempts,
          avgCallDuration: callMetrics.avgCallDuration,
          responseSpeed: `${callMetrics.pickupResponse}s`,
          interestedLeads: stageCounts.interestedLeads ?? 0,
          enrolledLeads: enrolledInRange,
          conversionRatio: `${rangeConversionRatio}%`,
          followUpsCreated: followUpsCreated,
          followUpsCompleted: followUpsCompleted,
          followUpCompletionRate: `${followUpCompletionRate}%`,
          untouchedLeads: untouchedRes.rows[0]?.untouchedLeads ?? 0,
        },

        hourlyActivity: hourlyActivity,
      };
    } catch (error) {
      console.error('[TelecallerAnalyticsStrategy] Error fetching analytics:', error);
      throw error;
    }
  }
}
