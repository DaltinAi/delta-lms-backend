import { Test, TestingModule } from '@nestjs/testing';
import { StageGroupsService } from './stage-groups.service';
import { DbService } from '../db/db.service';
import { ErrorService } from '../common/error/error.service';

const mockDbQuery = jest.fn();
const mockDbTransaction = jest.fn();

const mockDbService = {
  query: mockDbQuery,
  transaction: mockDbTransaction,
};

const mockErrorService = {
  errorThrower: jest.fn().mockImplementation((status, opts) => {
    const err: any = new Error(opts.message);
    err.status = status;
    throw err;
  }),
};

describe('StageGroupsService', () => {
  let service: StageGroupsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StageGroupsService,
        { provide: DbService, useValue: mockDbService },
        { provide: ErrorService, useValue: mockErrorService },
      ],
    }).compile();

    service = module.get<StageGroupsService>(StageGroupsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createStageGroup()', () => {
    const dto = { name: 'Hot Leads', description: 'All interested leads', stage_ids: ['s-1', 's-2'] };

    it('should create a stage group with stages and return it', async () => {
      const groupRow = { id: 'sg-1', name: 'Hot Leads' };
      const finalRow = { id: 'sg-1', name: 'Hot Leads', stages: [{ id: 's-1' }, { id: 's-2' }] };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [groupRow] })  // insert group
          .mockResolvedValueOnce({ rows: [] })           // insert members
          .mockResolvedValueOnce({ rows: [finalRow] }), // fetch result
      };
      mockDbTransaction.mockImplementationOnce((cb: any) => cb(mockClient));

      const result = await service.createStageGroup('cid', dto as any);
      expect(result.stages).toHaveLength(2);
    });

    it('should create a stage group without stages', async () => {
      const groupRow = { id: 'sg-2', name: 'Empty Group' };
      const finalRow = { id: 'sg-2', name: 'Empty Group', stages: [] };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [groupRow] })
          .mockResolvedValueOnce({ rows: [finalRow] }),
      };
      mockDbTransaction.mockImplementationOnce((cb: any) => cb(mockClient));

      const result = await service.createStageGroup('cid', { name: 'Empty Group', stage_ids: [] } as any);
      expect(result.stages).toHaveLength(0);
    });

    it('should throw 409 on duplicate group name', async () => {
      const pgError: any = new Error('unique_violation');
      pgError.code = '23505';

      const mockClient = {
        query: jest.fn().mockRejectedValueOnce(pgError),
      };
      mockDbTransaction.mockImplementationOnce((cb: any) => cb(mockClient));

      await expect(service.createStageGroup('cid', dto as any)).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('getStageGroups()', () => {
    it('should return stage groups with nested stages', async () => {
      const rows = [
        { id: 'sg-1', name: 'Group A', stages: [{ id: 's-1', name: 'New Lead' }] },
        { id: 'sg-2', name: 'Group B', stages: [] },
      ];
      mockDbQuery.mockResolvedValueOnce({ rows });

      const result = await service.getStageGroups('cid');
      expect(result).toHaveLength(2);
      expect(result[0].stages[0].name).toBe('New Lead');
    });

    it('should return empty array when no groups', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      const result = await service.getStageGroups('cid');
      expect(result).toEqual([]);
    });
  });
});
