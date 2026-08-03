import { Test, TestingModule } from '@nestjs/testing';
import { FollowUpsController } from './follow-ups.controller';
import { FollowUpsService } from './follow-ups.service';
import { ErrorService } from '../common/error/error.service';

const mockFollowUpsService = {
  createFollowUp: jest.fn(),
  getFollowUps: jest.fn(),
  completeFollowUp: jest.fn(),
};

const mockErrorService = {
  errorThrower: jest.fn().mockImplementation((status, opts) => {
    const err: any = new Error(opts.message);
    err.status = status;
    throw err;
  }),
};

const mockUser = { userId: 'uid-1', company_id: 'cid-1' };

describe('FollowUpsController', () => {
  let controller: FollowUpsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FollowUpsController],
      providers: [
        { provide: FollowUpsService, useValue: mockFollowUpsService },
        { provide: ErrorService, useValue: mockErrorService },
      ],
    }).compile();

    controller = module.get<FollowUpsController>(FollowUpsController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createFollowUp()', () => {
    it('should create a follow-up and return 201 response', async () => {
      const followUp = { id: 'fu-1', lead_id: 'l-1', mode: 'call' };
      mockFollowUpsService.createFollowUp.mockResolvedValueOnce(followUp);

      const result = await controller.createFollowUp({ leadId: 'l-1', scheduledFor: '2026-07-20', mode: 'call' } as any, mockUser);
      expect(result).toEqual({ status: 201, message: 'Follow-up scheduled', data: followUp });
    });

    it('should propagate 404 when lead not found', async () => {
      mockFollowUpsService.createFollowUp.mockRejectedValueOnce({ status: 404, message: 'Lead not found' });
      await expect(controller.createFollowUp({} as any, mockUser)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('getFollowUps()', () => {
    it('should return follow-ups with status 200', async () => {
      const rows = [{ id: 'fu-1' }, { id: 'fu-2' }];
      mockFollowUpsService.getFollowUps.mockResolvedValueOnce(rows);

      const result = await controller.getFollowUps('userId=uid-1', mockUser);
      expect(result).toEqual({ status: 200, data: rows });
      expect(mockFollowUpsService.getFollowUps).toHaveBeenCalledWith('cid-1', 'userId=uid-1');
    });

    it('should work with no filter string', async () => {
      mockFollowUpsService.getFollowUps.mockResolvedValueOnce([]);
      const result = await controller.getFollowUps(undefined as any, mockUser);
      expect(result.data).toEqual([]);
    });
  });

  describe('completeFollowUp()', () => {
    it('should mark follow-up complete and return updated record', async () => {
      const updated = { id: 'fu-1', status: 'completed' };
      mockFollowUpsService.completeFollowUp.mockResolvedValueOnce(updated);

      const result = await controller.completeFollowUp('fu-1', mockUser);
      expect(result).toEqual({ status: 200, message: 'Follow-up marked as completed', data: updated });
    });

    it('should propagate 404 when follow-up not found', async () => {
      mockFollowUpsService.completeFollowUp.mockRejectedValueOnce({ status: 404, message: 'Follow-up not found' });
      await expect(controller.completeFollowUp('fu-missing', mockUser)).rejects.toMatchObject({ status: 404 });
    });
  });
});
