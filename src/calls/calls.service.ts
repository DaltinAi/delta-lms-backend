import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ErrorService } from '../common/error/error.service';

@Injectable()
export class CallsService {
  private readonly CRM_BACKEND_URL = process.env.CRM_BACKEND_URL || 'http://localhost:3000';

  constructor(private readonly errorService: ErrorService) {}

  async proxyCall(endpoint: string, body: any) {
    try {
      const response = await fetch(`${this.CRM_BACKEND_URL}/calls/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        this.errorService.errorThrower(response.status, { message: data.message || 'Failed to fetch calls' });
      }

      return data;
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, { message: error.message || 'Internal server error', details: error });
    }
  }
}
