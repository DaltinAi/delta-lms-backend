import { Test, TestingModule } from '@nestjs/testing';
import { InvitationsService } from './invitations.service';
import { DbService } from '../db/db.service';
import { ErrorService } from '../common/error/error.service';

const mockDbQuery = jest.fn();
const mockDbTransaction = jest.fn();

const mockDbService = {
  query: mockDbQuery,
  transaction: mockDbTransaction,
};

const mockErrorService = {
  errorThrower: jest.fn().mockImplementation((status, opts) => {
    const err: any = new Error(opts.message);
    err.status = status;
    throw err;
  }),
};

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

describe('InvitationsService', () => {
  let service: InvitationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationsService,
        { provide: DbService, useValue: mockDbService },
        { provide: ErrorService, useValue: mockErrorService },
      ],
    }).compile();

    service = module.get<InvitationsService>(InvitationsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── createInvitation ─────────────────────────────────────────────────────

  describe('createInvitation()', () => {
    const dto = { email: 'new@acme.com', role: 'telecaller' };

    it('should create an invitation and return invite link', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [] }) // user check
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'inv-1',
              email: dto.email,
              role: 'telecaller',
              token: 'tok',
              expires_at: new Date(),
            },
          ],
        }); // insert

      const result = await service.createInvitation('cid', 'inviter-id', dto);
      expect(result.message).toContain('successfully');
      expect(result.inviteLink).toContain('token=');
    });

    it('should throw 409 when user with email already exists in company', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'existing' }] });
      await expect(
        service.createInvitation('cid', 'uid', dto as any),
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  // ─── acceptInvitation ─────────────────────────────────────────────────────

  describe('acceptInvitation()', () => {
    const dto = {
      token: 'valid-token',
      firstName: 'John',
      lastName: 'Doe',
      password: 'Pass@123',
    };

    it('should accept invitation and create user', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      const invite = {
        id: 'inv-1',
        company_id: 'cid',
        email: 'new@acme.com',
        role: 'telecaller',
        expires_at: futureDate,
      };

      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [invite] }) // token lookup
          .mockResolvedValueOnce({
            rows: [
              { id: 'uid-new', email: 'new@acme.com', role: 'telecaller' },
            ],
          }) // insert user
          .mockResolvedValueOnce({ rows: [] }), // mark used
      };

      mockDbTransaction.mockImplementationOnce((cb: any) => cb(mockClient));

      const result = await service.acceptInvitation(dto);
      expect(result.user.email).toBe('new@acme.com');
    });

    it('should throw 404 for invalid or used token', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValueOnce({ rows: [] }),
      };
      mockDbTransaction.mockImplementationOnce((cb: any) => cb(mockClient));

      await expect(service.acceptInvitation(dto as any)).rejects.toMatchObject({
        status: 404,
      });
    });

    it('should throw 400 for expired invitation', async () => {
      const pastDate = new Date(Date.now() - 86400000);
      const invite = {
        id: 'inv-1',
        company_id: 'cid',
        email: 'new@acme.com',
        role: 'telecaller',
        expires_at: pastDate,
      };

      const mockClient = {
        query: jest.fn().mockResolvedValueOnce({ rows: [invite] }),
      };
      mockDbTransaction.mockImplementationOnce((cb: any) => cb(mockClient));

      await expect(service.acceptInvitation(dto as any)).rejects.toMatchObject({
        status: 400,
      });
    });
  });

  // ─── getPendingInvitations ────────────────────────────────────────────────

  describe('getPendingInvitations()', () => {
    it('should return list of pending invitations', async () => {
      const rows = [
        { id: 'inv-1', email: 'a@b.com' },
        { id: 'inv-2', email: 'c@d.com' },
      ];
      mockDbQuery.mockResolvedValueOnce({ rows });

      const result = await service.getPendingInvitations('cid');
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no pending invitations', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      const result = await service.getPendingInvitations('cid');
      expect(result).toEqual([]);
    });
  });
});
