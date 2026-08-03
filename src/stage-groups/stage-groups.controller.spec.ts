import { Test, TestingModule } from '@nestjs/testing';
import { StageGroupsController } from './stage-groups.controller';
import { StageGroupsService } from './stage-groups.service';
import { ErrorService } from '../common/error/error.service';

const mockStageGroupsService = {
  createStageGroup: jest.fn(),
  getStageGroups: jest.fn(),
};

const mockErrorService = {
  errorThrower: jest.fn().mockImplementation((status, opts) => {
    const err: any = new Error(opts.message);
    err.status = status;
    throw err;
  }),
};

const mockUser = { userId: 'uid-admin', company_id: 'cid-1', role: 'admin' };

describe('StageGroupsController', () => {
  let controller: StageGroupsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StageGroupsController],
      providers: [
        { provide: StageGroupsService, useValue: mockStageGroupsService },
        { provide: ErrorService, useValue: mockErrorService },
      ],
    }).compile();

    controller = module.get<StageGroupsController>(StageGroupsController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createStageGroup()', () => {
    const dto = { name: 'Hot Leads', stage_ids: ['s-1', 's-2'] };

    it('should create a stage group and return it', async () => {
      const group = { id: 'sg-1', name: 'Hot Leads', stages: [{ id: 's-1' }, { id: 's-2' }] };
      mockStageGroupsService.createStageGroup.mockResolvedValueOnce(group);

      const result = await controller.createStageGroup(dto as any, mockUser);
      // controller returns raw service result (no status wrapper)
      expect(result).toEqual(group);
      expect(mockStageGroupsService.createStageGroup).toHaveBeenCalledWith('cid-1', dto);
    });

    it('should throw 403 when non-admin tries to create stage group', async () => {
      const nonAdmin = { ...mockUser, role: 'telecaller' };
      await expect(controller.createStageGroup(dto as any, nonAdmin)).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('getStageGroups()', () => {
    it('should return all stage groups for the company', async () => {
      const groups = [
        { id: 'sg-1', name: 'Group A', stages: [] },
        { id: 'sg-2', name: 'Group B', stages: [{ id: 's-1' }] },
      ];
      mockStageGroupsService.getStageGroups.mockResolvedValueOnce(groups);

      const result = await controller.getStageGroups(mockUser);
      // controller returns raw service result
      expect(result).toEqual(groups);
      expect(mockStageGroupsService.getStageGroups).toHaveBeenCalledWith('cid-1');
    });

    it('should return empty array when no groups', async () => {
      mockStageGroupsService.getStageGroups.mockResolvedValueOnce([]);
      const result = await controller.getStageGroups(mockUser);
      expect(result).toEqual([]);
    });
  });
});
