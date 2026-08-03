import { Test, TestingModule } from '@nestjs/testing';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { ErrorService } from '../common/error/error.service';

// Read the controller to understand its signature
// companies.controller.ts has a single POST / endpoint

const mockCompaniesService = {
  createCompany: jest.fn(),
};

const mockErrorService = {
  errorThrower: jest.fn().mockImplementation((status, opts) => {
    const err: any = new Error(opts.message);
    err.status = status;
    throw err;
  }),
};

describe('CompaniesController', () => {
  let controller: CompaniesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompaniesController],
      providers: [
        { provide: CompaniesService, useValue: mockCompaniesService },
        { provide: ErrorService, useValue: mockErrorService },
      ],
    }).compile();

    controller = module.get<CompaniesController>(CompaniesController);
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

    it('should create a company and return result', async () => {
      const serviceResult = {
        message:
          'Company and admin user created successfully with default stages.',
        company: { id: 'cid-1', name: 'Acme Corp', subdomain: 'acme' },
      };
      mockCompaniesService.createCompany.mockResolvedValueOnce(serviceResult);

      const result = await controller.createCompany(dto);
      expect(result).toEqual(serviceResult);
      expect(mockCompaniesService.createCompany).toHaveBeenCalledWith(dto);
    });

    it('should propagate 409 when subdomain is taken', async () => {
      mockCompaniesService.createCompany.mockRejectedValueOnce({
        status: 409,
        message: 'Subdomain already in use',
      });
      await expect(controller.createCompany(dto as any)).rejects.toMatchObject({
        status: 409,
      });
    });

    it('should propagate 409 when admin email is taken', async () => {
      mockCompaniesService.createCompany.mockRejectedValueOnce({
        status: 409,
        message: 'Admin email already in use',
      });
      await expect(controller.createCompany(dto as any)).rejects.toMatchObject({
        status: 409,
      });
    });

    it('should propagate 500 on unexpected error', async () => {
      mockCompaniesService.createCompany.mockRejectedValueOnce({
        message: 'Unexpected error',
      });
      await expect(controller.createCompany(dto as any)).rejects.toMatchObject({
        status: 500,
      });
    });
  });
});
