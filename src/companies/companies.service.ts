import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { TableConstants } from '../utils/table-constants';
import { PoolClient } from 'pg';
import * as bcrypt from 'bcrypt';
import { ErrorService } from '../common/error/error.service';
import { CreateCompanyDto } from './dto/create-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly dbService: DbService,
    private readonly errorService: ErrorService,
  ) {}

  async createCompany(data: CreateCompanyDto) {
    return this.dbService.transaction(async (client: PoolClient) => {
      // 1. Check if subdomain exists
      const existingCompany = await client.query(
        `SELECT id FROM ${TableConstants.COMPANIES} WHERE subdomain = $1`,
        [data.subdomain],
      );

      if (existingCompany.rows.length > 0) {
        this.errorService.errorThrower(409, {
          message: 'Subdomain already in use',
        });
      }

      // 2. Check if admin email exists
      const existingUser = await client.query(
        `SELECT id FROM ${TableConstants.USERS} WHERE email = $1`,
        [data.adminEmail],
      );

      if (existingUser.rows.length > 0) {
        this.errorService.errorThrower(409, {
          message: 'Admin email already in use',
        });
      }

      // 3. Create Company
      const companyResult = await client.query(
        `INSERT INTO ${TableConstants.COMPANIES} (name, subdomain) VALUES ($1, $2) RETURNING id, name, subdomain`,
        [data.companyName, data.subdomain],
      );

      const companyId = companyResult.rows[0].id;

      // 4. Create Admin User
      const defaultPassword = data.adminPassword || 'changeme123';
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      await client.query(
        `INSERT INTO ${TableConstants.USERS} (email, password, company_id, role, first_name, last_name) 
         VALUES ($1, $2, $3, 'admin', $4, $5)`,
        [
          data.adminEmail,
          hashedPassword,
          companyId,
          data.adminFirstName || 'Admin',
          data.adminLastName || '',
        ],
      );

      // 5. Create 15 Default Stages
      const defaultStages = [
        {
          key: 'new',
          name: 'New Lead',
          sort_order: 100,
          is_default: true,
          stage_type: 'neutral',
        },
        {
          key: 'live_call',
          name: 'Live Call',
          sort_order: 200,
          is_default: false,
          stage_type: 'system',
        },
        {
          key: 'call_not_pick',
          name: 'Call Not Picked',
          sort_order: 300,
          is_default: false,
          stage_type: 'negative',
        },
        {
          key: 'wrong_number',
          name: 'Wrong Number',
          sort_order: 400,
          is_default: false,
          stage_type: 'negative',
        },
        {
          key: 'missed_call',
          name: 'Missed Call',
          sort_order: 500,
          is_default: false,
          stage_type: 'negative',
        },
        {
          key: 'pending',
          name: 'Pending Lead',
          sort_order: 600,
          is_default: false,
          stage_type: 'neutral',
        },
        {
          key: 'interested',
          name: 'Interested Lead',
          sort_order: 700,
          is_default: false,
          stage_type: 'positive',
        },
        {
          key: 'not_interested',
          name: 'Not Interested',
          sort_order: 800,
          is_default: false,
          stage_type: 'negative',
        },
        {
          key: 'not_eligible',
          name: 'Not Eligible',
          sort_order: 900,
          is_default: false,
          stage_type: 'negative',
        },
        {
          key: 'follow_up',
          name: 'Follow Up',
          sort_order: 1000,
          is_default: false,
          stage_type: 'neutral',
        },
        {
          key: 'walk_in',
          name: 'Walk-in',
          sort_order: 1100,
          is_default: false,
          stage_type: 'positive',
        },
        {
          key: 'appointment',
          name: 'Appointment Booked',
          sort_order: 1200,
          is_default: false,
          stage_type: 'positive',
        },
        {
          key: 'enrolled',
          name: 'Enrolled',
          sort_order: 1300,
          is_default: false,
          stage_type: 'positive',
        },
        {
          key: 'day_close',
          name: 'Day Close',
          sort_order: 1400,
          is_default: false,
          stage_type: 'system',
        },
        {
          key: 'monthly_performance',
          name: 'Monthly Performance',
          sort_order: 1500,
          is_default: false,
          stage_type: 'system',
        },
      ];

      for (const stage of defaultStages) {
        await client.query(
          `INSERT INTO ${TableConstants.STAGES} (company_id, key, name, sort_order, is_default, stage_type)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            companyId,
            stage.key,
            stage.name,
            stage.sort_order,
            stage.is_default,
            stage.stage_type,
          ],
        );
      }

      return {
        message:
          'Company and admin user created successfully with default stages.',
        company: companyResult.rows[0],
      };
    });
  }
}
