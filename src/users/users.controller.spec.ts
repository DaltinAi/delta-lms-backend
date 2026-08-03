import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ErrorService } from '../common/error/error.service';

const mockUsersService = {
  getProfile: jest.fn(),
  getActiveTelecallers: jest.fn(),
  getUserById: jest.fn(),
};

const mockErrorService = {
  errorThrower: jest.fn().mockImplementation((status, opts) => {
    const err: any = new Error(opts.message);
    err.status = status;
    throw err;
  }),
};

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: ErrorService, useValue: mockErrorService },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getProfile()', () => {
    const mockUser = { userId: 'uid-1', company_id: 'cid' };

    it('should return profile when user is authenticated', async () => {
      const profile = { id: 'uid-1', email: 'u@x.com', company: { name: 'Acme' } };
      mockUsersService.getProfile.mockResolvedValueOnce(profile);

      const result = await controller.getProfile(mockUser);
      expect(result).toEqual(profile);
    });

    it('should throw 401 if user not provided', async () => {
      await expect(controller.getProfile(null)).rejects.toMatchObject({ status: 401 });
    });

    it('should throw 404 when profile not found', async () => {
      mockUsersService.getProfile.mockResolvedValueOnce(null);
      await expect(controller.getProfile(mockUser)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('getActiveTelecallers()', () => {
    it('should return list of telecaller IDs', async () => {
      mockUsersService.getActiveTelecallers.mockResolvedValueOnce(['tc-1', 'tc-2']);
      const result = await controller.getActiveTelecallers();
      expect(result).toEqual({ status: 200, data: ['tc-1', 'tc-2'] });
    });
  });

  describe('getUserById()', () => {
    it('should return a user by ID', async () => {
      const user = { id: 'uid-1', email: 'u@x.com' };
      mockUsersService.getUserById.mockResolvedValueOnce(user);

      const result = await controller.getUserById('uid-1');
      expect(result).toEqual({ status: 200, data: user });
    });

    it('should throw 404 when user not found', async () => {
      mockUsersService.getUserById.mockResolvedValueOnce(null);
      await expect(controller.getUserById('missing-id')).rejects.toMatchObject({ status: 404 });
    });
  });
});
