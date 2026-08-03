import { Test, TestingModule } from '@nestjs/testing';
import { CallsService } from './calls.service';
import { ErrorService } from '../common/error/error.service';

const mockErrorService = {
  errorThrower: jest.fn().mockImplementation((status, opts) => {
    const err: any = new Error(opts.message);
    err.status = status;
    throw err;
  }),
};

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('CallsService', () => {
  let service: CallsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CallsService,
        { provide: ErrorService, useValue: mockErrorService },
      ],
    }).compile();

    service = module.get<CallsService>(CallsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('proxyCall()', () => {
    it('should forward the call to CRM backend and return data', async () => {
      const responseData = { status: 'success', callId: 'c-1' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(responseData),
      });

      const result = await service.proxyCall('initiate', { leadId: 'l-1', phone: '9876543210' });
      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/calls/initiate'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should throw when CRM backend returns non-OK status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: jest.fn().mockResolvedValueOnce({ message: 'Bad Gateway' }),
      });

      await expect(service.proxyCall('initiate', {})).rejects.toMatchObject({ status: 502 });
    });

    it('should throw 500 on network/fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      await expect(service.proxyCall('initiate', {})).rejects.toMatchObject({ status: 500 });
    });
  });
});
