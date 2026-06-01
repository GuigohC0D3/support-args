import { Controller, Post, Get, Query, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { IntegrationsService, IntegrationTicketDto } from './integrations.service';

class CreateIntegrationTicketDto implements IntegrationTicketDto {
  @IsString() apiKey: string;
  user:   { email: string; name: string };
  ticket: { title: string; description: string; category?: string };
}

class TrackCommentDto {
  @IsString() @MinLength(2) body: string;
}

@ApiTags('Integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(private service: IntegrationsService) {}

  @Public()
  @Get('project')
  @ApiOperation({ summary: 'Get project info by API key' })
  getProject(@Query('apiKey') apiKey: string) {
    return this.service.getProjectByKey(apiKey);
  }

  @Public()
  @Post('tickets')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create ticket via integration API key' })
  createTicket(@Body() dto: CreateIntegrationTicketDto) {
    return this.service.createTicket(dto);
  }

  @Public()
  @Get('track/:token')
  @ApiOperation({ summary: 'Get ticket by tracking token (public)' })
  getTracked(@Param('token') token: string) {
    return this.service.getTrackedTicket(token);
  }

  @Public()
  @Post('track/:token/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add comment via tracking token (public)' })
  addTrackedComment(@Param('token') token: string, @Body() dto: TrackCommentDto) {
    return this.service.addTrackedComment(token, dto.body);
  }
}
