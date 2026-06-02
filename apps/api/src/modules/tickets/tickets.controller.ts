import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, HttpCode, HttpStatus, UseInterceptors, UploadedFiles, BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiQuery, ApiParam } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';

@ApiTags('Tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private service: TicketsService) {}

  @Get()
  @ApiOperation({ summary: 'List tickets with filters and pagination' })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['OPEN','IN_PROGRESS','WAITING_CLIENT','RESOLVED','CLOSED'] })
  @ApiQuery({ name: 'priority', required: false, enum: ['LOW','MEDIUM','HIGH','URGENT'] })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated ticket list with total count' })
  findAll(@Query() query: ListTicketsDto, @CurrentUser() user: any) {
    const role = user.organizations?.[0]?.role;
    return this.service.findAll(query, user.id, user.isMasterAdmin, role);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new ticket' })
  @ApiBody({ type: CreateTicketDto })
  @ApiResponse({ status: 201, description: 'Ticket created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: any) {
    return this.service.create(dto, dto.organizationId, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket details with comments, attachments and history' })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Ticket detail' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const role = user.organizations?.[0]?.role;
    return this.service.findOne(id, user.id, user.isMasterAdmin, role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update ticket status, priority, assignee or content' })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  @ApiBody({ type: UpdateTicketDto })
  @ApiResponse({ status: 200, description: 'Ticket updated' })
  @ApiResponse({ status: 403, description: 'Not a member of this organization' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  update(@Param('id') id: string, @Body() dto: UpdateTicketDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user.id, user.isMasterAdmin);
  }

  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a public or internal comment to a ticket' })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  @ApiBody({ type: CreateCommentDto })
  @ApiResponse({ status: 201, description: 'Comment added' })
  addComment(
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: any,
  ) {
    return this.service.addComment(id, dto, user.id);
  }

  @Post(':id/attachments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload image or video attachments to a ticket (max 10 files, 50MB each)' })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } } } })
  @ApiResponse({ status: 201, description: 'Attachments saved' })
  @ApiResponse({ status: 400, description: 'No files sent or invalid file type' })
  @UseInterceptors(FilesInterceptor('files', 10, {
    storage: diskStorage({
      destination: (req, _file, cb) => {
        const dir = join(process.cwd(), 'uploads', 'attachments', req.params.id);
        mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
    }),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
        return cb(new BadRequestException('Apenas imagens e vídeos são permitidos'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 50 * 1024 * 1024 },
  }))
  uploadAttachments(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: any,
  ) {
    if (!files?.length) throw new BadRequestException('Nenhum arquivo enviado');
    return this.service.addAttachments(id, files, user.id, user.isMasterAdmin);
  }

  @Get(':id/history')
  getHistory(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.getHistory(id, user.id, user.isMasterAdmin);
  }
}
