import { Test, TestingModule } from '@nestjs/testing';
import { FollowUpsService } from './follow-ups.service';
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

describe('FollowUpsService', () => {
  let service: FollowUpsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowUpsService,
        { provide: DbService, useValue: mockDbService },
        { provide: ErrorService, useValue: mockErrorService },
      ],
    }).compile();

    service = module.get<FollowUpsService>(FollowUpsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── createFollowUp ───────────────────────────────────────────────────────

  describe('createFollowUp()', () => {
    const dto = { leadId: 'lead-1', scheduledFor: '2026-07-20T10:00:00Z', mode: 'call', note: 'Call back' };

    it('should create a follow-up and return it', async () => {
      const followUp = { id: 'fu-1', lead_id: 'lead-1', mode: 'call' };
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ id: 'lead-1' }] }) // lead check
        .mockResolvedValueOnce({ rows: [followUp] });         // insert

      const result = await service.createFollowUp('cid', 'uid', dto as any);
      expect(result).toEqual(followUp);
    });

    it('should throw 404 when lead does not belong to company', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      await expect(service.createFollowUp('cid', 'uid', dto as any)).rejects.toMatchObject({ status: 404 });
    });
  });

  // ─── getFollowUps ─────────────────────────────────────────────────────────

  describe('getFollowUps()', () => {
    it('should return follow-ups with no filters', async () => {
      const rows = [{ id: 'fu-1' }, { id: 'fu-2' }];
      mockDbQuery.mockResolvedValueOnce({ rows });

      const result = await service.getFollowUps('cid');
      expect(result).toEqual(rows);
    });

    it('should filter by userId when provided', async () => {
      const rows = [{ id: 'fu-1' }];
      mockDbQuery.mockResolvedValueOnce({ rows });

      const result = await service.getFollowUps('cid', 'userId=user-1');
      expect(result).toEqual(rows);

      const call = mockDbQuery.mock.calls[0];
      expect(call[0]).toContain('created_by');
      expect(call[1]).toContain('user-1');
    });

    it('should filter by startDate and endDate when provided', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await service.getFollowUps('cid', 'startDate=2026-06-01,endDate=2026-07-01');

      const call = mockDbQuery.mock.calls[0];
      expect(call[0]).toContain('scheduled_for >=');
      expect(call[0]).toContain('scheduled_for <=');
      expect(call[1]).toContain('2026-06-01');
    });

    it('should filter by leadId when provided', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'fu-3' }] });

      await service.getFollowUps('cid', 'leadId=lead-99');
      const call = mockDbQuery.mock.calls[0];
      expect(call[0]).toContain('lead_id');
      expect(call[1]).toContain('lead-99');
    });

    it('should apply all filters together', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await service.getFollowUps('cid', 'startDate=2026-06-17,endDate=2026-07-17,userId=user-abc');
      const call = mockDbQuery.mock.calls[0];
      expect(call[0]).toContain('created_by');
      expect(call[0]).toContain('scheduled_for >=');
      expect(call[0]).toContain('scheduled_for <=');
    });
  });

  // ─── completeFollowUp ─────────────────────────────────────────────────────

  describe('completeFollowUp()', () => {
    it('should mark follow-up as completed', async () => {
      const completed = { id: 'fu-1', status: 'completed' };
      mockDbQuery.mockResolvedValueOnce({ rows: [completed] });

      const result = await service.completeFollowUp('fu-1', 'cid');
      expect(result).toEqual(completed);
    });

    it('should throw 404 when follow-up not found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      await expect(service.completeFollowUp('fu-missing', 'cid')).rejects.toMatchObject({ status: 404 });
    });
  });
});
