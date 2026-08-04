import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class BookLeadDto {
  @IsString()
  country: string;

  @IsOptional()
  @IsString()
  preferredCity?: string;

  @IsOptional()
  @IsString()
  passportNo?: string;

  @IsOptional()
  @IsString()
  passportCountryOfIssue?: string;

  @IsOptional()
  @IsString()
  passportExpiry?: string;

  @IsOptional()
  @IsString()
  packageAmount?: string;

  @IsOptional()
  @IsString()
  advanceFee?: string;

  @IsOptional()
  @IsBoolean()
  refundable?: boolean;

  @IsOptional()
  @IsBoolean()
  nonRefundable?: boolean;

  @IsOptional()
  @IsString()
  agentName?: string;

  @IsOptional()
  @IsString()
  amountForAgent?: string;
}
