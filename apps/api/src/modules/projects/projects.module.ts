import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports:     [IntegrationsModule],
  controllers: [ProjectsController],
  providers:   [ProjectsService],
  exports:     [ProjectsService],
})
export class ProjectsModule {}
