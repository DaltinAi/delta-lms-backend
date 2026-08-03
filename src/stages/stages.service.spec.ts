import { Test, TestingModule } from '@nestjs/testing';
import { StagesService } from './stages.service';
import { DbService } from '../db/db.service';
import { ErrorService } from '../common/error/error.service';

const mockDbQuery = jest.fn();
const mockDbService = { query: mockDbQuery };

const mockErrorService = {
  errorThrower: jest.fn().mockImplementation((status, opts) => {
    const err: any = new Error(opts.message);
    err.status = status;
    throw err;
  }),
};

describe('StagesService', () => {
  let service: StagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StagesService,
        { provide: DbService, useValue: mockDbService },
        { provide: ErrorService, useValue: mockErrorService },
      ],
    }).compile();

    service = module.get<StagesService>(StagesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createStage()', () => {
    const dto = { key: 'new_lead', name: 'New Lead', sort_order: 100, is_active: true, stage_type: 'neutral' };

    it('should create a stage and return it', async () => {
      const stage = { id: 's-1', key: 'new_lead', name: 'New Lead' };
      mockDbQuery.mockResolvedValueOnce({ rows: [stage] });

      const result = await service.createStage('cid', dto as any);
      expect(result).toEqual(stage);
    });

    it('should throw 409 when key/name already exists (unique violation)', async () => {
      const pgError: any = new Error('unique_violation');
      pgError.code = '23505';
      mockDbQuery.mockRejectedValueOnce(pgError);

      await expect(service.createStage('cid', dto as any)).rejects.toMatchObject({ status: 409 });
    });

    it('should rethrow non-unique errors', async () => {
      mockDbQuery.mockRejectedValueOnce(new Error('DB connection failed'));
      await expect(service.createStage('cid', dto as any)).rejects.toThrow('DB connection failed');
    });

    it('should use default values for optional fields', async () => {
      const stage = { id: 's-2', key: 'test', name: 'Test' };
      mockDbQuery.mockResolvedValueOnce({ rows: [stage] });

      await service.createStage('cid', { key: 'test', name: 'Test' } as any);
      const callArgs = mockDbQuery.mock.calls[0][1];
      expect(callArgs[3]).toBe(100);    // default sort_order
      expect(callArgs[4]).toBe(true);   // default is_active
      expect(callArgs[5]).toBe('normal'); // default stage_type
    });
  });

  describe('getStages()', () => {
    it('should return stages ordered by sort_order', async () => {
      const stages = [
        { id: 's-1', sort_order: 100 },
        { id: 's-2', sort_order: 200 },
      ];
      mockDbQuery.mockResolvedValueOnce({ rows: stages });

      const result = await service.getStages('cid');
      expect(result).toEqual(stages);
    });

    it('should return empty array when no stages found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      const result = await service.getStages('cid');
      expect(result).toEqual([]);
    });
  });
});
