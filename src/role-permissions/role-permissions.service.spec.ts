import { Test, TestingModule } from '@nestjs/testing';
import { RolePermissionsService } from './role-permissions.service';
import { DbService } from '../db/db.service';
import { ErrorService } from '../common/error/error.service';

const mockDbTransaction = jest.fn();
const mockDbQuery = jest.fn();

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

describe('RolePermissionsService', () => {
  let service: RolePermissionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolePermissionsService,
        { provide: DbService, useValue: mockDbService },
        { provide: ErrorService, useValue: mockErrorService },
      ],
    }).compile();

    service = module.get<RolePermissionsService>(RolePermissionsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('updatePermissions()', () => {
    it('should upsert a single permission and return results', async () => {
      const perm = {
        id: 'p-1',
        role: 'telecaller',
        stage_id: 's-1',
        can_view: true,
        can_move_to: false,
      };

      const mockClient = {
        query: jest.fn().mockResolvedValueOnce({ rows: [perm] }),
      };
      mockDbTransaction.mockImplementationOnce((cb: any) => cb(mockClient));

      const dtos = [
        {
          role: 'telecaller',
          stage_id: 's-1',
          can_view: true,
          can_move_to: false,
        },
      ];
      const result = await service.updatePermissions('cid', dtos);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(perm);
    });

    it('should upsert multiple permissions in a single transaction', async () => {
      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [{ id: 'p-1' }] })
          .mockResolvedValueOnce({ rows: [{ id: 'p-2' }] }),
      };
      mockDbTransaction.mockImplementationOnce((cb: any) => cb(mockClient));

      const dtos = [
        {
          role: 'telecaller',
          stage_id: 's-1',
          can_view: true,
          can_move_to: false,
        },
        { role: 'admin', stage_id: 's-2', can_view: true, can_move_to: true },
      ];

      const result = await service.updatePermissions('cid', dtos);
      expect(result).toHaveLength(2);
    });
  });

  describe('getPermissions()', () => {
    it('should return all permissions for a company', async () => {
      const rows = [
        { id: 'p-1', role: 'telecaller' },
        { id: 'p-2', role: 'admin' },
      ];
      mockDbQuery.mockResolvedValueOnce({ rows });

      const result = await service.getPermissions('cid');
      expect(result).toEqual(rows);
    });

    it('should return empty array when no permissions set', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      const result = await service.getPermissions('cid');
      expect(result).toEqual([]);
    });
  });
});
