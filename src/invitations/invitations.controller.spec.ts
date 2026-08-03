import { Test, TestingModule } from '@nestjs/testing';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { ErrorService } from '../common/error/error.service';

const mockInvitationsService = {
  createInvitation: jest.fn(),
  acceptInvitation: jest.fn(),
  getPendingInvitations: jest.fn(),
};

const mockErrorService = {
  errorThrower: jest.fn().mockImplementation((status, opts) => {
    const err: any = new Error(opts.message);
    err.status = status;
    throw err;
  }),
};

const mockUser = { userId: 'uid-admin', company_id: 'cid-1', role: 'admin' };

describe('InvitationsController', () => {
  let controller: InvitationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvitationsController],
      providers: [
        { provide: InvitationsService, useValue: mockInvitationsService },
        { provide: ErrorService, useValue: mockErrorService },
      ],
    }).compile();

    controller = module.get<InvitationsController>(InvitationsController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createInvitation()', () => {
    const dto = { email: 'newuser@acme.com', role: 'telecaller' };

    it('should create an invitation and return invite link', async () => {
      const serviceResult = {
        message: 'Invitation created successfully',
        inviteLink: '/invite/accept?token=abc123',
        expiresAt: new Date(),
      };
      mockInvitationsService.createInvitation.mockResolvedValueOnce(serviceResult);

      const result = await controller.createInvitation(dto as any, mockUser);
      expect(result).toEqual(serviceResult);
      expect(mockInvitationsService.createInvitation).toHaveBeenCalledWith('cid-1', 'uid-admin', dto);
    });

    it('should propagate 409 when user already exists', async () => {
      mockInvitationsService.createInvitation.mockRejectedValueOnce({ status: 409, message: 'User already exists' });
      await expect(controller.createInvitation(dto as any, mockUser)).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('acceptInvitation()', () => {
    const dto = { token: 'valid-tok', firstName: 'John', lastName: 'Doe', password: 'Pass@123' };

    it('should accept invitation and return created user', async () => {
      const serviceResult = { message: 'Account created successfully', user: { id: 'uid-new', email: 'newuser@acme.com' } };
      mockInvitationsService.acceptInvitation.mockResolvedValueOnce(serviceResult);

      const result = await controller.acceptInvitation(dto as any);
      expect(result).toEqual(serviceResult);
    });

    it('should propagate 404 for invalid token', async () => {
      mockInvitationsService.acceptInvitation.mockRejectedValueOnce({ status: 404, message: 'Invalid token' });
      await expect(controller.acceptInvitation(dto as any)).rejects.toMatchObject({ status: 404 });
    });

    it('should propagate 400 for expired invitation', async () => {
      mockInvitationsService.acceptInvitation.mockRejectedValueOnce({ status: 400, message: 'Invitation has expired' });
      await expect(controller.acceptInvitation(dto as any)).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('getPendingInvitations()', () => {
    it('should return list of pending invitations', async () => {
      const rows = [{ id: 'inv-1', email: 'a@b.com' }];
      mockInvitationsService.getPendingInvitations.mockResolvedValueOnce(rows);

      const result = await controller.getPendingInvitations(mockUser);
      // controller returns raw service result
      expect(result).toEqual(rows);
      expect(mockInvitationsService.getPendingInvitations).toHaveBeenCalledWith('cid-1');
    });
  });
});
