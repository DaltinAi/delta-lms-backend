import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { TableConstants } from '../utils/table-constants';
import { CreateStageDto } from './dto/create-stage.dto';
import { ErrorService } from '../common/error/error.service';

@Injectable()
export class StagesService {
  constructor(
    private readonly dbService: DbService,
    private readonly errorService: ErrorService
  ) {}

  async createStage(companyId: string, dto: CreateStageDto) {
    try {
      const result = await this.dbService.query(
        `INSERT INTO ${TableConstants.STAGES}
         (company_id, key, name, sort_order, is_active, stage_type)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          companyId,
          dto.key,
          dto.name,
          dto.sort_order ?? 100,
          dto.is_active ?? true,
          dto.stage_type ?? 'normal'
        ]
      );
      return result.rows[0];
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        this.errorService.errorThrower(409, { message: 'Stage key or name already exists for this company' });
      }
      throw error;
    }
  }

  async getStages(companyId: string) {
    const result = await this.dbService.query(
      `SELECT * FROM ${TableConstants.STAGES} WHERE company_id = $1 ORDER BY sort_order ASC`,
      [companyId]
    );
    return result.rows;
  }
}
