import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsService } from './appointments.service';
import { DbService } from '../db/db.service';
import { ErrorService } from '../common/error/error.service';

describe('AppointmentsService', () => {
  let service: AppointmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: DbService,
          useValue: {
            transaction: jest.fn((cb) => cb({ query: jest.fn() })),
            query: jest.fn(),
          },
        },
        {
          provide: ErrorService,
          useValue: {
            errorThrower: jest.fn((status, err) => {
              const error: any = new Error(err.message);
              error.status = status;
              throw error;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should reject Sunday appointments', async () => {
    // 2026-08-09 is a Sunday
    await expect(
      service.create('comp-1', 'user-1', {
        leadId: '00000000-0000-0000-0000-000000000001',
        currentStageId: '00000000-0000-0000-0000-000000000002',
        appointmentDate: '2026-08-09',
        appointmentTime: '11:00',
      }),
    ).rejects.toThrow('Appointments can only be booked from Monday to Saturday.');
  });

  it('should reject appointments before 10:00 AM', async () => {
    // 2026-08-10 is a Monday
    await expect(
      service.create('comp-1', 'user-1', {
        leadId: '00000000-0000-0000-0000-000000000001',
        currentStageId: '00000000-0000-0000-0000-000000000002',
        appointmentDate: '2026-08-10',
        appointmentTime: '09:30',
      }),
    ).rejects.toThrow('Appointments can only be scheduled between 10:00 AM and 06:00 PM.');
  });

  it('should reject appointments after 06:00 PM', async () => {
    // 2026-08-10 is a Monday
    await expect(
      service.create('comp-1', 'user-1', {
        leadId: '00000000-0000-0000-0000-000000000001',
        currentStageId: '00000000-0000-0000-0000-000000000002',
        appointmentDate: '2026-08-10',
        appointmentTime: '18:30',
      }),
    ).rejects.toThrow('Appointments can only be scheduled between 10:00 AM and 06:00 PM.');
  });
});
