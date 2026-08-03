import { Test, TestingModule } from '@nestjs/testing';
import { VisitHistoryController } from './visit-history.controller';
import { VisitHistoryService } from './visit-history.service';
import { ErrorService } from '../common/error/error.service';

const mockVisitHistoryService = {
  createVisit: jest.fn(),
  getVisits: jest.fn(),
};

const mockErrorService = {
  errorThrower: jest.fn().mockImplementation((status, opts) => {
    const err: any = new Error(opts.message);
    err.status = status;
    throw err;
  }),
};

const mockUser = { userId: 'uid-1', company_id: 'cid-1', role: 'admin' };

describe('VisitHistoryController', () => {
  let controller: VisitHistoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VisitHistoryController],
      providers: [
        { provide: VisitHistoryService, useValue: mockVisitHistoryService },
        { provide: ErrorService, useValue: mockErrorService },
      ],
    }).compile();

    controller = module.get<VisitHistoryController>(VisitHistoryController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createVisit()', () => {
    const dto = { leadId: 'lead-1', visitDate: '2026-07-17', notes: 'Walked in today' };

    it('should create a visit and return 201 response', async () => {
      const visit = { id: 'v-1', lead_id: 'lead-1' };
      mockVisitHistoryService.createVisit.mockResolvedValueOnce(visit);

      const result = await controller.createVisit(dto as any, mockUser);
      expect(result).toEqual({ status: 201, message: 'Visit recorded successfully', data: visit });
      expect(mockVisitHistoryService.createVisit).toHaveBeenCalledWith('cid-1', 'uid-1', dto);
    });

    it('should propagate 404 when lead not found', async () => {
      mockVisitHistoryService.createVisit.mockRejectedValueOnce({ status: 404, message: 'Lead not found' });
      await expect(controller.createVisit(dto as any, mockUser)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('getVisits()', () => {
    it('should return visits with status 200', async () => {
      const rows = [{ id: 'v-1' }, { id: 'v-2' }];
      mockVisitHistoryService.getVisits.mockResolvedValueOnce(rows);

      const result = await controller.getVisits('leadId=lead-1', mockUser);
      expect(result).toEqual({ status: 200, data: rows });
      expect(mockVisitHistoryService.getVisits).toHaveBeenCalledWith('cid-1', 'leadId=lead-1');
    });

    it('should work with no filter string', async () => {
      mockVisitHistoryService.getVisits.mockResolvedValueOnce([]);
      const result = await controller.getVisits(undefined as any, mockUser);
      expect(result.data).toEqual([]);
    });
  });
});
