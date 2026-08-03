import { Test, TestingModule } from '@nestjs/testing';
import { CompaniesService } from './companies.service';
import { DbService } from '../db/db.service';
import { ErrorService } from '../common/error/error.service';

const mockDbTransaction = jest.fn();
const mockDbService = {
  query: jest.fn(),
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
  compare: jest.fn(),
}));

describe('CompaniesService', () => {
  let service: CompaniesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: DbService, useValue: mockDbService },
        { provide: ErrorService, useValue: mockErrorService },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createCompany()', () => {
    const dto = {
      companyName: 'Acme Corp',
      subdomain: 'acme',
      adminEmail: 'admin@acme.com',
      adminFirstName: 'Admin',
      adminLastName: 'User',
      adminPassword: 'Admin@123',
    };

    it('should create company, admin user and 15 default stages', async () => {
      const companyRow = { id: 'cid-1', name: 'Acme Corp', subdomain: 'acme' };

      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // subdomain check
          .mockResolvedValueOnce({ rows: [] }) // email check
          .mockResolvedValueOnce({ rows: [companyRow] }) // insert company
          .mockResolvedValueOnce({ rows: [] }) // insert admin
          // 15 stage inserts
          .mockResolvedValue({ rows: [] }),
      };

      mockDbTransaction.mockImplementationOnce((cb: any) => cb(mockClient));

      const result = await service.createCompany(dto);
      expect(result.company.id).toBe('cid-1');
      expect(result.message).toContain('successfully');
    });

    it('should throw 409 when subdomain already exists', async () => {
      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [{ id: 'existing-cid' }] }),
      };
      mockDbTransaction.mockImplementationOnce((cb: any) => cb(mockClient));

      await expect(service.createCompany(dto as any)).rejects.toMatchObject({
        status: 409,
      });
    });

    it('should throw 409 when admin email already exists', async () => {
      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // subdomain ok
          .mockResolvedValueOnce({ rows: [{ id: 'u1' }] }), // email taken
      };
      mockDbTransaction.mockImplementationOnce((cb: any) => cb(mockClient));

      await expect(service.createCompany(dto as any)).rejects.toMatchObject({
        status: 409,
      });
    });
  });
});
