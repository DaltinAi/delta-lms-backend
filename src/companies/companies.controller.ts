import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { ErrorService } from '../common/error/error.service';
import { CreateCompanyDto } from './dto/create-company.dto';

@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly errorService: ErrorService,
  ) {}

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createCompany(@Body() createCompanyDto: CreateCompanyDto) {
    try {
      return await this.companiesService.createCompany(createCompanyDto);
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, {
        message: error.message,
        details: error,
      });
    }
  }
}
