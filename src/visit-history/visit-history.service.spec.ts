import { Test, TestingModule } from '@nestjs/testing';
import { VisitHistoryService } from './visit-history.service';
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

describe('VisitHistoryService', () => {
  let service: VisitHistoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisitHistoryService,
        { provide: DbService, useValue: mockDbService },
        { provide: ErrorService, useValue: mockErrorService },
      ],
    }).compile();

    service = module.get<VisitHistoryService>(VisitHistoryService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createVisit()', () => {
    const dto = {
      leadId: 'lead-1',
      visitDate: '2026-07-17',
      notes: 'Walk-in visit',
    };

    it('should create a visit and return it', async () => {
      const visit = { id: 'v-1', lead_id: 'lead-1' };
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ id: 'lead-1' }] }) // lead check
        .mockResolvedValueOnce({ rows: [visit] }); // insert

      const result = await service.createVisit('cid', 'uid', dto);
      expect(result).toEqual(visit);
    });

    it('should throw 404 when lead not found for company', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      await expect(
        service.createVisit('cid', 'uid', dto as any),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('should store null notes when not provided', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ id: 'lead-1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'v-2', notes: null }] });

      const result = await service.createVisit('cid', 'uid', {
        leadId: 'lead-1',
        visitDate: '2026-07-17',
      });
      expect(result.notes).toBeNull();
    });
  });

  describe('getVisits()', () => {
    it('should return all visits for a company without filter', async () => {
      const rows = [{ id: 'v-1' }, { id: 'v-2' }];
      mockDbQuery.mockResolvedValueOnce({ rows });

      const result = await service.getVisits('cid');
      expect(result).toEqual(rows);
    });

    it('should filter visits by leadId when provided', async () => {
      const rows = [{ id: 'v-1', lead_id: 'lead-1' }];
      mockDbQuery.mockResolvedValueOnce({ rows });

      const result = await service.getVisits('cid', 'leadId=lead-1');
      expect(result).toEqual(rows);

      const callQuery = mockDbQuery.mock.calls[0][0];
      expect(callQuery).toContain('lead_id');
    });

    it('should return empty array when no visits found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      const result = await service.getVisits('cid', 'leadId=ghost');
      expect(result).toEqual([]);
    });
  });
});
