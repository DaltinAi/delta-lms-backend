import { Test, TestingModule } from '@nestjs/testing';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { ErrorService } from '../common/error/error.service';

const mockLeadsService = {
  createLead: jest.fn(),
  getLeads: jest.fn(),
  getLeadById: jest.fn(),
  updateLead: jest.fn(),
  updateLeadStage: jest.fn(),
  reassignLeads: jest.fn(),
  checkPhoneExists: jest.fn(),
};

const mockErrorService = {
  errorThrower: jest.fn().mockImplementation((status, opts) => {
    const err: any = new Error(opts.message);
    err.status = status;
    throw err;
  }),
};

const mockUser = { userId: 'uid-1', company_id: 'cid-1', role: 'admin' };

describe('LeadsController', () => {
  let controller: LeadsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeadsController],
      providers: [
        { provide: LeadsService, useValue: mockLeadsService },
        { provide: ErrorService, useValue: mockErrorService },
      ],
    }).compile();

    controller = module.get<LeadsController>(LeadsController);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── POST / ───────────────────────────────────────────────────────────────

  describe('createLead()', () => {
    it('should create and return a new lead', async () => {
      const lead = { id: 'l1', first_name: 'Jane' };
      mockLeadsService.createLead.mockResolvedValueOnce(lead);

      const result = await controller.createLead(
        { firstName: 'Jane', phone: '999' },
        mockUser,
      );
      expect(result).toEqual({
        status: 201,
        message: 'Lead created successfully',
        data: lead,
      });
    });

    it('should propagate errors from service', async () => {
      mockLeadsService.createLead.mockRejectedValueOnce({
        status: 500,
        message: 'DB error',
      });
      await expect(
        controller.createLead({} as any, mockUser),
      ).rejects.toMatchObject({ status: 500 });
    });
  });

  // ─── GET / ────────────────────────────────────────────────────────────────

  describe('getLeads()', () => {
    it('should return paginated leads', async () => {
      mockLeadsService.getLeads.mockResolvedValueOnce({
        data: [{ id: 'l1' }],
        total: 1,
      });

      const result = await controller.getLeads('limit=10');
      expect(result).toEqual({ status: 200, data: [{ id: 'l1' }], total: 1 });
    });
  });

  // ─── GET /check-phone ─────────────────────────────────────────────────────

  describe('checkPhone()', () => {
    it('should return exists: true when phone found', async () => {
      mockLeadsService.checkPhoneExists.mockResolvedValueOnce({
        exists: true,
        leadId: 'l1',
        name: 'John Doe',
      });

      const result = await controller.checkPhone('9876543210', mockUser);
      expect(result).toEqual({
        status: 200,
        exists: true,
        leadId: 'l1',
        name: 'John Doe',
      });
    });

    it('should return exists: false when phone not found', async () => {
      mockLeadsService.checkPhoneExists.mockResolvedValueOnce({
        exists: false,
      });

      const result = await controller.checkPhone('0000000000', mockUser);
      expect(result).toEqual({ status: 200, exists: false });
    });

    it('should throw 400 when phone query param is missing', async () => {
      await expect(controller.checkPhone('', mockUser)).rejects.toMatchObject({
        status: 400,
      });
    });
  });

  // ─── GET /:id ─────────────────────────────────────────────────────────────

  describe('getLeadById()', () => {
    it('should return a lead by ID', async () => {
      const lead = { id: 'l1' };
      mockLeadsService.getLeadById.mockResolvedValueOnce(lead);

      const result = await controller.getLeadById('l1');
      expect(result).toEqual({ status: 200, data: lead });
    });

    it('should throw 404 when lead not found', async () => {
      mockLeadsService.getLeadById.mockResolvedValueOnce(null);
      await expect(controller.getLeadById('missing')).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  // ─── PATCH /:id ───────────────────────────────────────────────────────────

  describe('updateLead()', () => {
    it('should update and return the lead', async () => {
      const updated = { id: 'l1', first_name: 'Updated' };
      mockLeadsService.updateLead.mockResolvedValueOnce(updated);

      const result = await controller.updateLead(
        'l1',
        { firstName: 'Updated' },
        mockUser,
      );
      expect(result).toEqual({
        status: 200,
        message: 'Lead updated successfully',
        data: updated,
      });
    });

    it('should throw 404 when lead not found for update', async () => {
      mockLeadsService.updateLead.mockResolvedValueOnce(null);
      await expect(
        controller.updateLead('missing', {} as any, mockUser),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  // ─── PATCH /:id/stage ─────────────────────────────────────────────────────

  describe('updateLeadStage()', () => {
    it('should update stage and return result', async () => {
      mockLeadsService.updateLeadStage.mockResolvedValueOnce({
        success: true,
        message: 'Stage updated successfully',
      });

      const result = await controller.updateLeadStage(
        'l1',
        { toStageId: 's1', remark: 'ok' },
        mockUser,
      );
      expect(result).toMatchObject({ status: 200, success: true });
    });
  });

  // ─── POST /reassign ───────────────────────────────────────────────────────

  describe('reassignLeads()', () => {
    it('should reassign and return result', async () => {
      mockLeadsService.reassignLeads.mockResolvedValueOnce({
        success: true,
        message: 'Reassigned 2 leads',
      });

      const result = await controller.reassignLeads(
        { leadIds: ['l1', 'l2'], toAssigneeId: 'tc-1' },
        mockUser,
      );
      expect(result.success).toBe(true);
    });
  });
});
