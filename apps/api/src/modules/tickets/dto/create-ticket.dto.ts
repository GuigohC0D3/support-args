import { IsString, IsEnum, IsOptional, MinLength, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TicketPriority, TicketCategory } from '@support-hub/database';

export class TicketImpactDto {
  blocked?: 'yes' | 'partial' | 'no';
  frequency?: 'first_time' | 'sometimes' | 'always';
  scope?: 'just_me' | 'my_team' | 'everyone';
  financial?: 'yes' | 'no';
  urgency?: 'can_wait' | 'need_today' | 'everything_stopped';
}

export class CreateTicketDto {
  @ApiProperty()
  @IsString()
  organizationId: string;

  @ApiProperty()
  @IsString()
  projectId: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  title: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  description: string;

  @ApiProperty({ enum: TicketPriority, default: TicketPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiProperty({ enum: TicketCategory, required: false })
  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory;

  @ApiProperty({ type: TicketImpactDto, required: false })
  @IsOptional()
  @IsObject()
  impactData?: TicketImpactDto;
}
