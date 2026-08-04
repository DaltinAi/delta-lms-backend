import { Test, TestingModule } from '@nestjs/testing';
import { LeadsService } from './leads.service';
import { DbService } from '../db/db.service';
import { UsersService } from '../users/users.service';
import { ErrorService } from '../common/error/error.service';

const mockDbQuery = jest.fn();
const mockDbTransaction = jest.fn();

const mockDbService = {
  query: mockDbQuery,
  transaction: mockDbTransaction,
  usersTable: 'users_delta',
};

const mockUsersService = {
  getActiveTelecallers: jest.fn(),
};

const mockErrorService = {
  errorThrower: jest.fn().mockImplementation((status, opts) => {
    const err: any = new Error(opts.message);
    err.status = status;
    throw err;
  }),
};

describe('LeadsService', () => {
  let service: LeadsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: DbService, useValue: mockDbService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: ErrorService, useValue: mockErrorService },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── checkPhoneExists ─────────────────────────────────────────────────────

  describe('checkPhoneExists()', () => {
    it('should return exists: true with leadId and name when phone found', async () => {
      const mockLead = { id: 'lead-1', first_name: 'John', last_name: 'Doe' };
      mockDbQuery.mockResolvedValueOnce({
        rows: [mockLead],
      });

      const result = await service.checkPhoneExists('cid', '9876543210');
      expect(result).toEqual({
        exists: true,
        leadId: 'lead-1',
        name: 'John Doe',
        lead: mockLead,
      });
    });

    it('should return exists: false when phone not found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      const result = await service.checkPhoneExists('cid', '0000000000');
      expect(result).toEqual({ exists: false });
    });

    it('should trim name when lastName is empty', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ id: 'lead-2', first_name: 'Alice', last_name: '' }],
      });
      const result = await service.checkPhoneExists('cid', '1111111111');
      expect(result).toMatchObject({ exists: true, name: 'Alice' });
    });

    it('should throw on DB error', async () => {
      mockDbQuery.mockRejectedValueOnce(new Error('DB down'));
      await expect(
        service.checkPhoneExists('cid', '9999999999'),
      ).rejects.toThrow('DB down');
    });
  });

  // ─── getLeads ─────────────────────────────────────────────────────────────

  describe('getLeads()', () => {
    it('should return data and total using window function result', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [
          { id: 'l1', first_name: 'A', total_count: '5' },
          { id: 'l2', first_name: 'B', total_count: '5' },
        ],
      });

      const result = await service.getLeads();
      expect(result.total).toBe(5);
      expect(result.data).toHaveLength(2);
      // total_count should be stripped from rows
      expect(result.data[0]).not.toHaveProperty('total_count');
    });

    it('should return total 0 when no rows', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      const result = await service.getLeads();
      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });

    it('should parse limit and offset from filterStr', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ id: 'l1', total_count: '100' }],
      });
      const result = await service.getLeads('limit=25,offset=50');
      expect(result.total).toBe(100);
    });

    it('should not pass pagination values to the pending count query', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ id: 'l1', total_count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ today_count: 1, next_day_count: 0 }] });

      await service.getLeads(
        'limit=10,offset=0,tab=today,stageType=pending',
        undefined,
        undefined,
        'telecaller',
        'uid-telecaller',
      );

      expect(mockDbQuery).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        ['uid-telecaller', 'pending', 'telecaller'],
      );
    });
  });

  // ─── getLeadById ─────────────────────────────────────────────────────────

  describe('getLeadById()', () => {
    it('should return lead when found', async () => {
      const lead = { id: 'lead-1', first_name: 'John' };
      mockDbQuery.mockResolvedValueOnce({ rows: [lead] });
      const result = await service.getLeadById('lead-1');
      expect(result).toEqual(lead);
    });

    it('should return null when lead not found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      const result = await service.getLeadById('ghost');
      expect(result).toBeNull();
    });
  });

  // ─── createLead ───────────────────────────────────────────────────────────

  describe('createLead()', () => {
    it('should create a lead and return it', async () => {
      const newLead = { id: 'lead-new', first_name: 'Jane' };

      mockUsersService.getActiveTelecallers.mockResolvedValueOnce(['tc-1']);
      mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'tc-1' }] }); // round-robin

      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [{ id: 'stage-1' }] }) // default stage
          .mockResolvedValueOnce({ rows: [newLead] }) // insert lead
          .mockResolvedValueOnce({ rows: [] }) // stage history
          .mockResolvedValueOnce({ rows: [] }), // assignment history
      };

      mockDbTransaction.mockImplementationOnce((cb: any) => cb(mockClient));

      const result = await service.createLead('cid', 'uid', {
        firstName: 'Jane',
        phone: '9876543210',
      });

      expect(result).toEqual(newLead);
    });
  });

  // ─── updateLead ───────────────────────────────────────────────────────────

  describe('updateLead()', () => {
    it('should update and return the lead', async () => {
      const updated = { id: 'l1', first_name: 'Updated' };
      mockDbTransaction.mockImplementationOnce(async (cb) =>
        cb({ query: jest.fn().mockResolvedValueOnce({ rows: [updated] }) }),
      );

      const result = await service.updateLead('l1', 'cid', {
        firstName: 'Updated',
      }, 'uid');
      expect(result).toEqual(updated);
    });

    it('should return null when lead not found', async () => {
      mockDbTransaction.mockImplementationOnce(async (cb) =>
        cb({ query: jest.fn().mockResolvedValueOnce({ rows: [] }) }),
      );
      const result = await service.updateLead('l1', 'cid', {
        firstName: 'X',
      }, 'uid');
      expect(result).toBeNull();
    });

    it('should call getLeadById when no fields provided', async () => {
      const lead = { id: 'l1' };
      mockDbTransaction.mockImplementationOnce(async (cb) =>
        cb({ query: jest.fn().mockResolvedValueOnce({ rows: [lead] }) }),
      );
      const result = await service.updateLead('l1', 'cid', {}, 'uid');
      expect(result).toEqual(lead);
    });
  });

  // ─── reassignLeads ────────────────────────────────────────────────────────

  describe('reassignLeads()', () => {
    it('should reassign leads and return success', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ id: 'tc-1', role: 'telecaller' }] }) // user check
        .mockResolvedValueOnce({ rows: [{ id: 'l1', assigned_to: 'tc-old' }] }) // get leads
        .mockResolvedValueOnce({ rows: [] }) // update
        .mockResolvedValueOnce({ rows: [] }); // history

      const result = await service.reassignLeads(['l1'], 'tc-1', 'admin-1');
      expect(result.success).toBe(true);
    });

    it('should throw when telecaller not found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      await expect(
        service.reassignLeads(['l1'], 'bad-tc', 'admin'),
      ).rejects.toThrow();
    });
  });
});
