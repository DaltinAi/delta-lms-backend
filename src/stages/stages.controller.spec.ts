import { Test, TestingModule } from '@nestjs/testing';
import { StagesController } from './stages.controller';
import { StagesService } from './stages.service';
import { ErrorService } from '../common/error/error.service';

const mockStagesService = {
  createStage: jest.fn(),
  getStages: jest.fn(),
};

const mockErrorService = {
  errorThrower: jest.fn().mockImplementation((status, opts) => {
    const err: any = new Error(opts.message);
    err.status = status;
    throw err;
  }),
};

const mockUser = { userId: 'uid-1', company_id: 'cid-1', role: 'admin' };

describe('StagesController', () => {
  let controller: StagesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StagesController],
      providers: [
        { provide: StagesService, useValue: mockStagesService },
        { provide: ErrorService, useValue: mockErrorService },
      ],
    }).compile();

    controller = module.get<StagesController>(StagesController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createStage()', () => {
    const dto = { key: 'warm_lead', name: 'Warm Lead', sort_order: 500, stage_type: 'positive' };

    it('should create stage and return it', async () => {
      const stage = { id: 's-1', ...dto };
      mockStagesService.createStage.mockResolvedValueOnce(stage);

      const result = await controller.createStage(dto as any, mockUser);
      expect(result).toEqual({ status: 201, message: 'Stage created successfully', data: stage });
      expect(mockStagesService.createStage).toHaveBeenCalledWith('cid-1', dto);
    });

    it('should propagate 409 for duplicate stage key', async () => {
      mockStagesService.createStage.mockRejectedValueOnce({ status: 409, message: 'Stage key already exists' });
      await expect(controller.createStage(dto as any, mockUser)).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('getStages()', () => {
    it('should return all stages for the company', async () => {
      const stages = [{ id: 's-1' }, { id: 's-2' }];
      mockStagesService.getStages.mockResolvedValueOnce(stages);

      const result = await controller.getStages(mockUser);
      expect(result).toEqual({ status: 200, data: stages });
      expect(mockStagesService.getStages).toHaveBeenCalledWith('cid-1');
    });

    it('should return empty array when no stages', async () => {
      mockStagesService.getStages.mockResolvedValueOnce([]);
      const result = await controller.getStages(mockUser);
      expect(result.data).toEqual([]);
    });
  });
});
