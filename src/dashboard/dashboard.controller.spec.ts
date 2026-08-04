import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ErrorService } from '../common/error/error.service';

const mockDashboardService = {
  getStats: jest.fn(),
};

const mockErrorService = {
  errorThrower: jest.fn().mockImplementation((status, opts) => {
    const err: any = new Error(opts.message);
    err.status = status;
    throw err;
  }),
};

const mockAdminUser = {
  userId: 'uid-admin',
  company_id: 'cid-1',
  role: 'admin',
};
const mockTelecallerUser = {
  userId: 'uid-tc',
  company_id: 'cid-1',
  role: 'telecaller',
};

describe('DashboardController', () => {
  let controller: DashboardController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: mockDashboardService },
        { provide: ErrorService, useValue: mockErrorService },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getStats()', () => {
    const mockStats = {
      totalLeads: 42,
      countryBreakdown: [{ country: 'India', count: 30 }],
      branchBreakdown: [{ branch: 'Delhi', count: 20 }],
    };

    it('should return dashboard stats for admin', async () => {
      mockDashboardService.getStats.mockResolvedValueOnce(mockStats);

      const result = await controller.getStats(
        '2026-01-01',
        '2026-07-17',
        mockAdminUser,
      );
      expect(result).toEqual({ status: 200, data: mockStats });
      expect(mockDashboardService.getStats).toHaveBeenCalledWith(
        'cid-1',
        'uid-admin',
        'admin',
        '2026-01-01',
        '2026-07-17',
      );
    });

    it('should return dashboard stats for telecaller', async () => {
      mockDashboardService.getStats.mockResolvedValueOnce({
        ...mockStats,
        totalLeads: 10,
      });

      const result = await controller.getStats(
        undefined as any,
        undefined as any,
        mockTelecallerUser,
      );
      expect(result.data.totalLeads).toBe(10);
      expect(mockDashboardService.getStats).toHaveBeenCalledWith(
        'cid-1',
        'uid-tc',
        'telecaller',
        undefined,
        undefined,
      );
    });

    it('should use fallback company id when not present on user', async () => {
      mockDashboardService.getStats.mockResolvedValueOnce(mockStats);

      const userWithoutCompany = { userId: 'uid-1', role: 'admin' };
      await controller.getStats(
        undefined as any,
        undefined as any,
        userWithoutCompany,
      );

      expect(mockDashboardService.getStats).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000000',
        'uid-1',
        'admin',
        undefined,
        undefined,
      );
    });

    it('should propagate errors from service', async () => {
      mockDashboardService.getStats.mockRejectedValueOnce({
        status: 500,
        message: 'DB error',
      });
      await expect(
        controller.getStats(undefined as any, undefined as any, mockAdminUser),
      ).rejects.toMatchObject({ status: 500 });
    });
  });
});
