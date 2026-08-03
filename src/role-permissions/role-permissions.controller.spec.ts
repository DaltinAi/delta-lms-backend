import { Test, TestingModule } from '@nestjs/testing';
import { RolePermissionsController } from './role-permissions.controller';
import { RolePermissionsService } from './role-permissions.service';
import { ErrorService } from '../common/error/error.service';

const mockRolePermissionsService = {
  updatePermissions: jest.fn(),
  getPermissions: jest.fn(),
};

const mockErrorService = {
  errorThrower: jest.fn().mockImplementation((status, opts) => {
    const err: any = new Error(opts.message);
    err.status = status;
    throw err;
  }),
};

const mockUser = { userId: 'uid-admin', company_id: 'cid-1', role: 'admin' };

describe('RolePermissionsController', () => {
  let controller: RolePermissionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolePermissionsController],
      providers: [
        { provide: RolePermissionsService, useValue: mockRolePermissionsService },
        { provide: ErrorService, useValue: mockErrorService },
      ],
    }).compile();

    controller = module.get<RolePermissionsController>(RolePermissionsController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('updatePermissions()', () => {
    const dtos = [{ role: 'telecaller', stage_id: 's-1', can_view: true, can_move_to: false }];

    it('should update permissions and return results', async () => {
      const results = [{ id: 'p-1', role: 'telecaller' }];
      mockRolePermissionsService.updatePermissions.mockResolvedValueOnce(results);

      const result = await controller.updatePermissions(dtos as any, mockUser);
      expect(result).toEqual(results);
      expect(mockRolePermissionsService.updatePermissions).toHaveBeenCalledWith('cid-1', dtos);
    });

    it('should propagate errors from service', async () => {
      mockRolePermissionsService.updatePermissions.mockRejectedValueOnce({ status: 500, message: 'DB error' });
      await expect(controller.updatePermissions(dtos as any, mockUser)).rejects.toMatchObject({ status: 500 });
    });

    it('should throw 403 when non-admin tries to update permissions', async () => {
      const nonAdmin = { ...mockUser, role: 'telecaller' };
      await expect(controller.updatePermissions(dtos as any, nonAdmin)).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('getPermissions()', () => {
    it('should return all permissions for company', async () => {
      const rows = [{ id: 'p-1', role: 'telecaller' }, { id: 'p-2', role: 'admin' }];
      mockRolePermissionsService.getPermissions.mockResolvedValueOnce(rows);

      const result = await controller.getPermissions(mockUser);
      expect(result).toEqual(rows);
      expect(mockRolePermissionsService.getPermissions).toHaveBeenCalledWith('cid-1');
    });

    it('should return empty array when no permissions exist', async () => {
      mockRolePermissionsService.getPermissions.mockResolvedValueOnce([]);
      const result = await controller.getPermissions(mockUser);
      expect(result).toEqual([]);
    });
  });
});
