import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { TableConstants } from '../utils/table-constants';
import { UpdateRolePermissionDto } from './dto/role-permission.dto';
import { ErrorService } from '../common/error/error.service';

@Injectable()
export class RolePermissionsService {
  constructor(
    private readonly dbService: DbService,
    private readonly errorService: ErrorService
  ) {}

  async updatePermissions(companyId: string, dtos: UpdateRolePermissionDto[]) {
    return this.dbService.transaction(async (client) => {
      const results = [];
      for (const dto of dtos) {
        const result = await client.query(
          `INSERT INTO ${TableConstants.ROLE_STAGE_PERMISSIONS} 
             (company_id, role, stage_id, can_view, can_move_to)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (company_id, role, stage_id) 
           DO UPDATE SET 
             can_view = EXCLUDED.can_view, 
             can_move_to = EXCLUDED.can_move_to,
             updated_at = NOW()
           RETURNING *`,
          [
            companyId,
            dto.role,
            dto.stage_id,
            dto.can_view ?? true,
            dto.can_move_to ?? false
          ]
        );
        results.push(result.rows[0]);
      }
      return results;
    });
  }

  async getPermissions(companyId: string) {
    const result = await this.dbService.query(
      `SELECT * FROM ${TableConstants.ROLE_STAGE_PERMISSIONS} WHERE company_id = $1`,
      [companyId]
    );
    return result.rows;
  }
}
