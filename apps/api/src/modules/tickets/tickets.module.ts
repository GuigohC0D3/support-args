import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports:     [NotificationsModule, IntegrationsModule],
  controllers: [TicketsController],
  providers:   [TicketsService],
})
export class TicketsModule {}
