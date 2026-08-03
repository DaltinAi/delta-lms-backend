import { Test, TestingModule } from '@nestjs/testing';
import { DbService } from './db.service';

// Mock the entire 'pg' module so no real DB connections are made
jest.mock('pg', () => {
  const mockQuery = jest.fn();
  const mockRelease = jest.fn();
  const mockConnect = jest.fn().mockResolvedValue({
    query: mockQuery,
    release: mockRelease,
  });
  const MockPool = jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    query: mockQuery,
    end: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    totalCount: 1,
    idleCount: 1,
    waitingCount: 0,
  }));
  return { Pool: MockPool };
});

describe('DbService', () => {
  let service: DbService;
  let poolQueryMock: jest.Mock;

  beforeEach(async () => {
    // Reset the singleton so each test gets a fresh instance
    (DbService as any).instance = undefined;

    const module: TestingModule = await Test.createTestingModule({
      providers: [DbService],
    }).compile();

    service = module.get<DbService>(DbService);

    // Grab the pool query mock from the service's internal pool
    poolQueryMock = (service as any).pool.query as jest.Mock;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('query()', () => {
    it('should execute a query and return the result', async () => {
      const fakeResult = { rows: [{ id: '1' }], rowCount: 1 };
      poolQueryMock.mockResolvedValueOnce(fakeResult);

      const result = await service.query('SELECT 1', []);

      expect(poolQueryMock).toHaveBeenCalledWith('SELECT 1', []);
      expect(result).toEqual(fakeResult);
    });

    it('should log a WARN for slow queries (>1000ms)', async () => {
      const fakeResult = { rows: [], rowCount: 0 };
      // Simulate 1200ms execution by delaying the mock
      poolQueryMock.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(fakeResult), 1200),
          ),
      );

      const warnSpy = jest.spyOn(require('@nestjs/common').Logger, 'warn').mockImplementation(() => {});

      await service.query('SELECT slow_thing FROM big_table');

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Slow query'));
      warnSpy.mockRestore();
    }, 10000);

    it('should throw and log error on query failure', async () => {
      const dbError = new Error('connection refused');
      poolQueryMock.mockRejectedValueOnce(dbError);

      await expect(service.query('SELECT 1')).rejects.toThrow('connection refused');
    });
  });

  describe('healthCheck()', () => {
    it('should return true when DB is reachable', async () => {
      poolQueryMock.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });
      const result = await service.healthCheck();
      expect(result).toBe(true);
    });

    it('should return false when DB is not reachable', async () => {
      poolQueryMock.mockRejectedValueOnce(new Error('DB down'));
      const result = await service.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe('getPoolStats()', () => {
    it('should return pool statistics', () => {
      const stats = service.getPoolStats();
      expect(stats).toEqual({
        totalCount: expect.any(Number),
        idleCount: expect.any(Number),
        waitingCount: expect.any(Number),
      });
    });
  });
});
