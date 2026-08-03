import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ErrorService } from '../common/error/error.service';

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
};

const mockErrorService = {
  errorThrower: jest.fn().mockImplementation((status, opts) => {
    const err: any = new Error(opts.message);
    err.status = status;
    throw err;
  }),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ErrorService, useValue: mockErrorService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('register()', () => {
    it('should delegate to authService.register and return result', async () => {
      const dto = {
        email: 'a@b.com',
        password: 'Pass@1',
        firstName: 'A',
        lastName: 'B',
        role: 'admin',
      };
      const serviceResult = { id: 'uid', email: 'a@b.com' };
      mockAuthService.register.mockResolvedValueOnce(serviceResult);

      const result = await controller.register(dto);
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(serviceResult);
    });

    it('should call errorThrower when service throws', async () => {
      mockAuthService.register.mockRejectedValueOnce({
        status: 409,
        message: 'Email exists',
      });
      await expect(controller.register({} as any)).rejects.toMatchObject({
        status: 409,
      });
    });
  });

  describe('login()', () => {
    it('should delegate to authService.login and return tokens', async () => {
      const dto = { email: 'a@b.com', password: 'Pass@1' };
      const tokens = { accessToken: 'acc', refreshToken: 'ref', user: {} };
      mockAuthService.login.mockResolvedValueOnce(tokens);

      const result = await controller.login(dto);
      expect(result).toEqual(tokens);
    });

    it('should propagate 401 on invalid credentials', async () => {
      mockAuthService.login.mockRejectedValueOnce({
        status: 401,
        message: 'Invalid credentials',
      });
      await expect(controller.login({} as any)).rejects.toMatchObject({
        status: 401,
      });
    });
  });

  describe('refresh()', () => {
    it('should return new tokens', async () => {
      const tokens = { accessToken: 'new-acc', refreshToken: 'new-ref' };
      mockAuthService.refresh.mockResolvedValueOnce(tokens);
      const result = await controller.refresh('old-refresh');
      expect(result).toEqual(tokens);
    });
  });

  describe('logout()', () => {
    it('should call authService.logout and return message', async () => {
      mockAuthService.logout.mockResolvedValueOnce({
        message: 'Logged out successfully',
      });
      const result = await controller.logout('refresh-token');
      expect(result.message).toContain('Logged out');
    });
  });

  describe('forgotPassword()', () => {
    it('should call authService.forgotPassword', async () => {
      const msg = { message: 'If an account exists...' };
      mockAuthService.forgotPassword.mockResolvedValueOnce(msg);
      const result = await controller.forgotPassword({ email: 'x@y.com' });
      expect(result).toEqual(msg);
    });
  });

  describe('resetPassword()', () => {
    it('should call authService.resetPassword', async () => {
      const msg = { message: 'Password has been reset successfully' };
      mockAuthService.resetPassword.mockResolvedValueOnce(msg);
      const result = await controller.resetPassword({
        token: 'tok',
        password: 'New@123',
      });
      expect(result).toEqual(msg);
    });
  });
});
