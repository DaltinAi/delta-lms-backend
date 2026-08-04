import { Injectable, BadRequestException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { TableConstants } from '../utils/table-constants';

@Injectable()
export class EnrollmentsService {
  constructor(private readonly dbService: DbService) {}

  async enrollLead(
    leadId: string,
    companyId: string,
    counsellorId: string,
    enrollmentData: any,
  ) {
    return this.dbService.transaction(async (client) => {
      // 1. Validate required fields
      const {
        country,
        preferredCity,
        packageAmount,
        advanceFee,
        advanceType,
        agentName,
        amountForAgent,
        metadata,
      } = enrollmentData;

      if (
        !country ||
        packageAmount == null ||
        advanceFee == null ||
        !advanceType
      ) {
        throw new BadRequestException('Missing mandatory enrollment fields');
      }

      // 2. Calculate post_visa_amount
      const postVisaAmount = Number(packageAmount) - Number(advanceFee);

      // 3. Insert into enrollments_delta
      const insertResult = await client.query(
        `INSERT INTO enrollments_delta 
         (lead_id, company_id, counsellor_id, country, preferred_city, package_amount, advance_fee, advance_type, post_visa_amount, agent_name, amount_for_agent, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          leadId,
          companyId,
          counsellorId,
          country,
          preferredCity || null,
          packageAmount,
          advanceFee,
          advanceType,
          postVisaAmount,
          agentName || null,
          amountForAgent || null,
          metadata || {},
        ],
      );

      // 4. Update lead stage to Enrolled (assume enrolled stage is fetched dynamically)
      const enrolledStageResult = await client.query(
        `SELECT id FROM ${TableConstants.STAGES} WHERE company_id = $1 AND role = 'counsellor' AND key = 'enrolled' LIMIT 1`,
        [companyId],
      );

      if (enrolledStageResult.rows.length > 0) {
        const enrolledStageId = enrolledStageResult.rows[0].id;

        const leadRes = await client.query(
          `SELECT current_stage_id FROM ${TableConstants.LEADS} WHERE id = $1`,
          [leadId],
        );
        const currentStageId = leadRes.rows[0]?.current_stage_id;

        await client.query(
          `UPDATE ${TableConstants.LEADS} SET current_stage_id = $1, updated_at = NOW() WHERE id = $2`,
          [enrolledStageId, leadId],
        );

        await client.query(
          `INSERT INTO ${TableConstants.LEAD_STAGE_HISTORY}
           (lead_id, company_id, from_stage_id, to_stage_id, changed_by, remark)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            leadId,
            companyId,
            currentStageId,
            enrolledStageId,
            counsellorId,
            'Enrolled Confirmed',
          ],
        );
      }

      return insertResult.rows[0];
    });
  }
}
