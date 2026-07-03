import { Injectable } from '@nestjs/common';
import { DbService } from '../../db/db.service';
import { getCallMetrics, getHourlyCallActivity } from '../../utils/ivr-firebase';

export interface AnalyticsParams {
  startDate: string;
  endDate: string;
  targetUserId?: string;
  requesterId?: string;
}

const COMPANY_ID = process.env.COMPANY_ID ?? '2a2db2e1-6ec4-47f6-b3ad-6be0174833f7';

@Injectable()
export class TelecallerAnalyticsStrategy {
  constructor(private readonly dbService: DbService) {}

  async getAnalytics(params: AnalyticsParams): Promise<any> {
    try {
      const finalStartDate = new Date(params.startDate);
      const finalEndDate = new Date(params.endDate);

      // Target telecaller is either the specified one or the requester themselves
      const targetUserId = params.targetUserId ?? params.requesterId;

      // Leads-based WHERE: scoped to user and date range
      const leadsWhere = `l.is_deleted = false AND l.assigned_to = $1 AND l.created_at >= $2 AND l.created_at <= $3`;
      const leadsParams = [targetUserId, finalStartDate, finalEndDate];

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
           FROM tbl_leads l
           LEFT JOIN tbl_stages s ON s.id = l.current_stage_id
           WHERE ${leadsWhere}`,
          leadsParams,
        ),

        // 2. Untouched leads in range
        this.dbService.query(
          `SELECT COUNT(*)::int AS "untouchedLeads"
               FROM tbl_leads l
               WHERE l.is_deleted = false
                 AND l.assigned_to = $1
                 AND l.created_at >= $2
                 AND l.created_at <= $3
                 AND NOT EXISTS (
                   SELECT 1 FROM tbl_lead_stage_history h
                   WHERE h.lead_id = l.id
                     AND h.created_at >= $2
                     AND h.created_at <= $3
                     AND h.id != (
                       SELECT id FROM tbl_lead_stage_history
                       WHERE lead_id = l.id ORDER BY created_at ASC LIMIT 1
                     )
                 )`,
          leadsParams,
        ),

        // 3. Follow-ups metrics
        this.dbService.query(
          `SELECT
             COUNT(*)::int AS "totalFollowUpsCreated",
             SUM(CASE WHEN fu.completed_at >= $1 AND fu.completed_at <= $2 THEN 1 ELSE 0 END)::int AS "completedFollowUps"
           FROM tbl_follow_ups fu
           WHERE fu.created_at >= $1 AND fu.created_at <= $2 AND fu.created_by = $3`,
          [finalStartDate, finalEndDate, targetUserId],
        ),

        // 4. Call Metrics from Firebase
        getCallMetrics(
          COMPANY_ID,
          finalStartDate,
          finalEndDate,
          targetUserId,
        ),

        // 5. Hourly Activity from Firebase
        getHourlyCallActivity(
          COMPANY_ID,
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
