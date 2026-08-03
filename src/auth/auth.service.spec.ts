import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { DbService } from '../db/db.service';
import { ErrorService } from '../common/error/error.service';

// ─── Shared mocks ────────────────────────────────────────────────────────────

const mockDbQuery = jest.fn();
const mockDbTransaction = jest.fn();

const mockDbService = {
  query: mockDbQuery,
  transaction: mockDbTransaction,
  usersTable: 'users_delta',
  refreshTokensTable: 'refresh_tokens_delta',
  passwordResetsTable: 'password_resets_delta',
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-token'),
  verify: jest.fn(),
};

const mockErrorService = {
  errorThrower: jest.fn().mockImplementation((status, opts) => {
    const err: any = new Error(opts.message);
    err.status = status;
    throw err;
  }),
};

// ─── Bcrypt mock ──────────────────────────────────────────────────────────────
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DbService, useValue: mockDbService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ErrorService, useValue: mockErrorService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── register ──────────────────────────────────────────────────────────────

  describe('register()', () => {
    const dto = {
      email: 'test@example.com',
      password: 'Pass@123',
      firstName: 'John',
      lastName: 'Doe',
      role: 'admin',
    };

    it('should register a new user successfully', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [] }) // email check
        .mockResolvedValueOnce({
          rows: [{ id: 'uuid-1', email: dto.email, firstName: 'John', lastName: 'Doe', role: 'admin' }],
        }); // insert

      const result = await service.register(dto);
      expect(result.email).toBe(dto.email);
    });

    it('should throw 409 if email already registered', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'existing' }] });
      await expect(service.register(dto)).rejects.toMatchObject({ status: 409 });
    });
  });

  // ─── login ─────────────────────────────────────────────────────────────────

  describe('login()', () => {
    const dto = { email: 'test@example.com', password: 'Pass@123' };

    it('should login successfully with valid credentials', async () => {
      mockDbQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'uid', email: dto.email, password: 'hashed', first_name: 'J', last_name: 'D', role: 'admin', company_id: 'cid' }],
        }) // find user
        .mockResolvedValueOnce({ rows: [] }); // save refresh token

      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      const result = await service.login(dto);
      expect(result.user.email).toBe(dto.email);
      expect(result.accessToken).toBe('mock-token');
    });

    it('should throw 401 when user not found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      await expect(service.login(dto)).rejects.toMatchObject({ status: 401 });
    });

    it('should throw 401 when password is wrong', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ id: 'uid', email: dto.email, password: 'hashed', role: 'admin', company_id: 'cid' }],
      });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
      await expect(service.login(dto)).rejects.toMatchObject({ status: 401 });
    });
  });

  // ─── logout ────────────────────────────────────────────────────────────────

  describe('logout()', () => {
    it('should revoke the refresh token', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      const result = await service.logout('refresh-token-xyz');
      expect(result.message).toContain('Logged out');
    });
  });

  // ─── forgotPassword ────────────────────────────────────────────────────────

  describe('forgotPassword()', () => {
    it('should return generic message even when email not found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      const result = await service.forgotPassword({ email: 'unknown@x.com' });
      expect(result.message).toContain('If an account exists');
    });

    it('should create reset token when email exists', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ id: 'uid' }] })
        .mockResolvedValueOnce({ rows: [] });
      const result = await service.forgotPassword({ email: 'found@x.com' });
      expect(result.message).toContain('If an account exists');
    });
  });

  // ─── refresh ───────────────────────────────────────────────────────────────

  describe('refresh()', () => {
    const payload = { sub: 'uid', email: 'u@x.com', role: 'admin', company_id: 'cid' };

    it('should throw 401 for invalid refresh token signature', async () => {
      mockJwtService.verify.mockImplementationOnce(() => { throw new Error('invalid'); });
      await expect(service.refresh('bad-token')).rejects.toMatchObject({ status: 401 });
    });

    it('should rotate token when refresh is valid', async () => {
      mockJwtService.verify.mockReturnValueOnce(payload);

      const now = new Date();
      const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ id: 'tok-id', user_id: 'uid', is_used: false, is_revoked: false, expires_at: futureDate }] })
          .mockResolvedValueOnce({ rows: [{ company_id: 'cid' }] })
          .mockResolvedValueOnce({ rows: [] }) // mark used
          .mockResolvedValueOnce({ rows: [] }), // insert new
      };

      mockDbTransaction.mockImplementationOnce((cb: any) => cb(mockClient));

      const result = await service.refresh('valid-refresh-token');
      expect(result.accessToken).toBe('mock-token');
    });

    it('should throw 401 and revoke all tokens on reuse detection', async () => {
      mockJwtService.verify.mockReturnValueOnce(payload);
      const futureDate = new Date(Date.now() + 86400000);

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ id: 'tok-id', user_id: 'uid', is_used: true, is_revoked: false, expires_at: futureDate }] })
          .mockResolvedValueOnce({ rows: [] }), // revoke all
      };

      mockDbTransaction.mockImplementationOnce((cb: any) => cb(mockClient));
      await expect(service.refresh('reused-token')).rejects.toMatchObject({ status: 401 });
    });
  });
});
