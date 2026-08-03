import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { TableConstants } from '../utils/table-constants';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { ErrorService } from '../common/error/error.service';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly dbService: DbService,
    private readonly errorService: ErrorService,
  ) {}

  async create(
    companyId: string,
    userId: string,
    createDto: CreateAppointmentDto,
  ) {
    try {
      return await this.dbService.transaction(async (client) => {
        // 1. Verify lead exists and belongs to company
        const leadRes = await client.query(
          `SELECT id FROM ${TableConstants.LEADS} WHERE id = $1 AND company_id = $2 AND is_deleted = false`,
          [createDto.leadId, companyId],
        );

        if (leadRes.rows.length === 0) {
          this.errorService.errorThrower(404, {
            message: 'Lead not found',
          });
        }

        // 2. Insert the appointment
        const insertRes = await client.query(
          `INSERT INTO ${TableConstants.APPOINTMENTS}
           (company_id, lead_id, current_stage_id, created_by, appointment_date, appointment_time, remark)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            companyId,
            createDto.leadId,
            createDto.currentStageId,
            userId,
            createDto.appointmentDate,
            createDto.appointmentTime,
            createDto.remark || null,
          ],
        );

        const newAppointment = insertRes.rows[0];

        // 3. Record stage history
        const historyRemark = `Appointment booked for ${createDto.appointmentDate} ${createDto.appointmentTime}. Notes: ${createDto.remark || 'None'}`;
        await client.query(
          `INSERT INTO ${TableConstants.LEAD_STAGE_HISTORY}
           (lead_id, company_id, from_stage_id, to_stage_id, changed_by, remark)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            createDto.leadId,
            companyId,
            createDto.currentStageId,
            createDto.currentStageId,
            userId,
            historyRemark,
          ],
        );

        return newAppointment;
      });
    } catch (error: any) {
      if (error.status) throw error; // Re-throw if it's already an HttpException/AppException
      this.errorService.errorThrower(500, {
        message: 'Error creating appointment',
        details: error,
      });
    }
  }

  async findAll(
    companyId: string,
    limit: number = 10,
    offset: number = 0,
    tab?: string,
    branch?: string,
  ) {
    try {
      let baseConditions = `a.company_id = $1 AND a.is_deleted = false`;
      const queryParams: any[] = [companyId];
      let paramIndex = 2;

      // Tab Filtering
      if (tab === 'Today') {
        baseConditions += ` AND a.appointment_date = CURRENT_DATE`;
      } else if (tab === 'ComingUp') {
        baseConditions += ` AND a.appointment_date > CURRENT_DATE`;
      } else if (tab === 'Overdue') {
        baseConditions += ` AND a.appointment_date < CURRENT_DATE AND a.status NOT IN ('COMPLETED', 'CANCELLED')`;
      }

      // Branch Filtering
      let joinLeads = false;
      if (branch) {
        joinLeads = true;
        baseConditions += ` AND LOWER(TRIM(l.data->>'branch')) = $${paramIndex}`;
        queryParams.push(branch.toLowerCase().trim());
        paramIndex++;
      }

      let query = `
        SELECT a.*, COUNT(a.id) OVER() AS total_count
        FROM ${TableConstants.APPOINTMENTS} a
      `;

      if (joinLeads) {
        query += ` JOIN ${TableConstants.LEADS} l ON a.lead_id = l.id`;
      }

      query += `
        WHERE ${baseConditions}
        ORDER BY a.appointment_date ASC, a.appointment_time ASC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      queryParams.push(limit, offset);

      const result = await this.dbService.query(query, queryParams);

      const total =
        result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      const data = result.rows.map(({ total_count, ...row }) => row);

      return { data, total };
    } catch (error: any) {
      if (error.status) throw error;
      this.errorService.errorThrower(500, {
        message: 'Error fetching appointments',
        details: error,
      });
    }
  }

  async findOne(id: string, companyId: string) {
    try {
      const result = await this.dbService.query(
        `SELECT * FROM ${TableConstants.APPOINTMENTS} WHERE id = $1 AND company_id = $2 AND is_deleted = false`,
        [id, companyId],
      );

      if (result.rows.length === 0) {
        this.errorService.errorThrower(404, {
          message: 'Appointment not found',
        });
      }

      return result.rows[0];
    } catch (error: any) {
      if (error.status) throw error;
      this.errorService.errorThrower(500, {
        message: 'Error fetching appointment by id',
        details: error,
      });
    }
  }

  async update(
    id: string,
    companyId: string,
    userId: string,
    updateDto: UpdateAppointmentDto,
  ) {
    try {
      return await this.dbService.transaction(async (client) => {
        // 1. Verify existence
        const existingRes = await client.query(
          `SELECT * FROM ${TableConstants.APPOINTMENTS} WHERE id = $1 AND company_id = $2 AND is_deleted = false FOR UPDATE`,
          [id, companyId],
        );

        if (existingRes.rows.length === 0) {
          this.errorService.errorThrower(404, {
            message: 'Appointment not found',
          });
        }

        const existing = existingRes.rows[0];

        // 2. Build update query
        const fields: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (updateDto.appointmentDate !== undefined) {
          fields.push(`appointment_date = $${idx++}`);
          values.push(updateDto.appointmentDate);
        }
        if (updateDto.appointmentTime !== undefined) {
          fields.push(`appointment_time = $${idx++}`);
          values.push(updateDto.appointmentTime);
        }
        if (updateDto.remark !== undefined) {
          fields.push(`remark = $${idx++}`);
          values.push(updateDto.remark);
        }
        if (updateDto.status !== undefined) {
          fields.push(`status = $${idx++}`);
          values.push(updateDto.status);
        }

        // Assume the receptionist updates this, so handled_by = userId
        fields.push(`handled_by = $${idx++}`);
        values.push(userId);

        fields.push(`updated_at = NOW()`);

        values.push(id, companyId);

        const updateQuery = `
          UPDATE ${TableConstants.APPOINTMENTS}
          SET ${fields.join(', ')}
          WHERE id = $${idx} AND company_id = $${idx + 1}
          RETURNING *
        `;

        const updatedRes = await client.query(updateQuery, values);
        const updatedAppointment = updatedRes.rows[0];

        // 3. Log into stage history
        const historyRemark = `Appointment status updated to ${updatedAppointment.status} by user (handled)`;
        await client.query(
          `INSERT INTO ${TableConstants.LEAD_STAGE_HISTORY}
           (lead_id, company_id, from_stage_id, to_stage_id, changed_by, remark)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            existing.lead_id,
            companyId,
            existing.current_stage_id,
            existing.current_stage_id,
            userId,
            historyRemark,
          ],
        );

        return updatedAppointment;
      });
    } catch (error: any) {
      if (error.status) throw error;
      this.errorService.errorThrower(500, {
        message: 'Error updating appointment',
        details: error,
      });
    }
  }

  async remove(id: string, companyId: string) {
    try {
      const result = await this.dbService.query(
        `UPDATE ${TableConstants.APPOINTMENTS}
         SET is_deleted = true, deleted_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND company_id = $2 AND is_deleted = false
         RETURNING id`,
        [id, companyId],
      );

      if (result.rows.length === 0) {
        this.errorService.errorThrower(404, {
          message: 'Appointment not found',
        });
      }

      return { success: true, message: 'Appointment deleted successfully' };
    } catch (error: any) {
      if (error.status) throw error;
      this.errorService.errorThrower(500, {
        message: 'Error deleting appointment',
        details: error,
      });
    }
  }
}
