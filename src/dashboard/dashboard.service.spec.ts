import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
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

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: DbService, useValue: mockDbService },
        { provide: ErrorService, useValue: mockErrorService },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getStats()', () => {
    const totalCountRow = { rows: [{ count: '42' }] };
    const followUpRow = { rows: [{ count: '5' }] };
    const countryRow = {
      rows: [
        { country: 'India', count: '30' },
        { country: 'UAE', count: '12' },
      ],
    };
    const branchRow = {
      rows: [{ branch_key: 'delhi', branch: 'Delhi', count: '20' }],
    };

    it('should return stats for admin (no user filter applied)', async () => {
      mockDbQuery
        .mockResolvedValueOnce(totalCountRow)
        .mockResolvedValueOnce(followUpRow)
        .mockResolvedValueOnce(countryRow)
        .mockResolvedValueOnce(branchRow);

      const result = await service.getStats('cid', 'uid', 'admin');

      expect(result.totalLeads).toBe(42);
      expect(result.countryBreakdown).toHaveLength(2);
      expect(result.branchBreakdown[0].branch).toBe('Delhi');
    });

    it('should apply created_by filter for non-admin roles', async () => {
      mockDbQuery
        .mockResolvedValueOnce(totalCountRow)
        .mockResolvedValueOnce(followUpRow)
        .mockResolvedValueOnce(countryRow)
        .mockResolvedValueOnce(branchRow);

      await service.getStats('cid', 'uid-tc', 'telecaller');

      // All 3 queries should include the userId param
      const firstCallParams = mockDbQuery.mock.calls[0][1];
      expect(firstCallParams).toContain('uid-tc');
    });

    it('should apply date range filters when provided', async () => {
      mockDbQuery
        .mockResolvedValueOnce(totalCountRow)
        .mockResolvedValueOnce(followUpRow)
        .mockResolvedValueOnce(countryRow)
        .mockResolvedValueOnce(branchRow);

      await service.getStats('cid', 'uid', 'admin', '2026-01-01', '2026-06-30');

      const firstCallParams = mockDbQuery.mock.calls[0][1];
      expect(firstCallParams).toContain('2026-01-01');
      expect(firstCallParams).toContain('2026-06-30T23:59:59.999Z');
    });

    it('should cap countryBreakdown to top 4 + "Other"', async () => {
      const manyCountries = Array.from({ length: 7 }, (_, i) => ({
        country: `Country${i}`,
        count: `${10 - i}`,
      }));

      mockDbQuery
        .mockResolvedValueOnce(totalCountRow)
        .mockResolvedValueOnce(followUpRow)
        .mockResolvedValueOnce({ rows: manyCountries })
        .mockResolvedValueOnce(branchRow);

      const result = await service.getStats('cid', 'uid', 'admin');

      expect(result.countryBreakdown).toHaveLength(5); // 4 + "Other"
      expect(result.countryBreakdown[4].country).toBe('Other');
    });

    it('should apply walk-in stage filter for receptionist role', async () => {
      mockDbQuery
        .mockResolvedValueOnce(totalCountRow)
        .mockResolvedValueOnce(followUpRow)
        .mockResolvedValueOnce(countryRow)
        .mockResolvedValueOnce(branchRow);

      await service.getStats('cid', 'uid-rec', 'receptionist');

      const firstCallQuery = mockDbQuery.mock.calls[0][0];
      expect(firstCallQuery).toContain('walk');
    });
  });
});
