import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { DbService } from '../db/db.service';
import { ErrorService } from '../common/error/error.service';

const mockDbQuery = jest.fn();

const mockDbService = {
  query: mockDbQuery,
};

const mockErrorService = {
  errorThrower: jest.fn().mockImplementation((status, opts) => {
    const err: any = new Error(opts.message);
    err.status = status;
    throw err;
  }),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: DbService, useValue: mockDbService },
        { provide: ErrorService, useValue: mockErrorService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getActiveTelecallers()', () => {
    it('should return an array of telecaller IDs', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ id: 'tc-1' }, { id: 'tc-2' }],
      });

      const result = await service.getActiveTelecallers();
      expect(result).toEqual(['tc-1', 'tc-2']);
    });

    it('should return empty array when no telecallers found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      const result = await service.getActiveTelecallers();
      expect(result).toEqual([]);
    });

    it('should throw when query fails', async () => {
      mockDbQuery.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.getActiveTelecallers()).rejects.toThrow('DB error');
    });
  });

  describe('getUserById()', () => {
    it('should return a user when found', async () => {
      const user = { id: 'uid', email: 'u@x.com', role: 'admin' };
      mockDbQuery.mockResolvedValueOnce({ rows: [user] });

      const result = await service.getUserById('uid');
      expect(result).toEqual(user);
    });

    it('should return null when user not found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      const result = await service.getUserById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getProfile()', () => {
    it('should return formatted profile with company info', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'uid',
            firebase_uid: null,
            email: 'u@x.com',
            role: 'admin',
            first_name: 'John',
            last_name: 'Doe',
            user_created_at: new Date(),
            company_id: 'cid',
            company_name: 'Acme',
            company_subdomain: 'acme',
            company_created_at: new Date(),
          },
        ],
      });

      const result = await service.getProfile('uid');
      expect(result.company.name).toBe('Acme');
      expect(result.email).toBe('u@x.com');
    });

    it('should return null when user not found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      const result = await service.getProfile('ghost-id');
      expect(result).toBeNull();
    });
  });
});
