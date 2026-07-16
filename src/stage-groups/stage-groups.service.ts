import { Injectable, ConflictException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { TableConstants } from '../utils/table-constants';
import { CreateStageGroupDto } from './dto/stage-group.dto';
import { ErrorService } from '../common/error/error.service';

@Injectable()
export class StageGroupsService {
  constructor(
    private readonly dbService: DbService,
    private readonly errorService: ErrorService
  ) {}

  async createStageGroup(companyId: string, dto: CreateStageGroupDto) {
    return this.dbService.transaction(async (client) => {
      try {
        const groupResult = await client.query(
          `INSERT INTO ${TableConstants.STAGE_GROUPS} (company_id, name, description)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [companyId, dto.name, dto.description || null]
        );
        const newGroup = groupResult.rows[0];

        if (dto.stage_ids && dto.stage_ids.length > 0) {
          const values = dto.stage_ids.map(id => `('${newGroup.id}', '${id}')`).join(',');
          await client.query(
            `INSERT INTO ${TableConstants.STAGE_GROUP_MEMBERS} (stage_group_id, stage_id)
             VALUES ${values} ON CONFLICT (stage_group_id, stage_id) DO NOTHING`
          );
        }

        const fetchQuery = `
          SELECT 
            sg.*,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', s.id,
                  'name', s.name,
                  'key', s.key,
                  'stage_type', s.stage_type
                ) ORDER BY s.sort_order
              ) FILTER (WHERE s.id IS NOT NULL),
              '[]'
            ) as stages
          FROM ${TableConstants.STAGE_GROUPS} sg
          LEFT JOIN ${TableConstants.STAGE_GROUP_MEMBERS} sgm ON sg.id = sgm.stage_group_id
          LEFT JOIN ${TableConstants.STAGES} s ON sgm.stage_id = s.id
          WHERE sg.id = $1
          GROUP BY sg.id
        `;
        const finalResult = await client.query(fetchQuery, [newGroup.id]);
        return finalResult.rows[0];

      } catch (error: any) {
        if (error.code === '23505') {
          this.errorService.errorThrower(409, { message: 'A stage group with this name already exists' });
        }
        throw error;
      }
    });
  }

  async getStageGroups(companyId: string) {
    const query = `
      SELECT 
        sg.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', s.id,
              'name', s.name,
              'key', s.key,
              'stage_type', s.stage_type,
              'sort_order', s.sort_order
            ) ORDER BY s.sort_order
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'
        ) as stages
      FROM ${TableConstants.STAGE_GROUPS} sg
      LEFT JOIN ${TableConstants.STAGE_GROUP_MEMBERS} sgm ON sg.id = sgm.stage_group_id
      LEFT JOIN ${TableConstants.STAGES} s ON sgm.stage_id = s.id
      WHERE sg.company_id = $1
      GROUP BY sg.id
      ORDER BY sg.created_at DESC
    `;
    const result = await this.dbService.query(query, [companyId]);
    return result.rows;
  }
}
