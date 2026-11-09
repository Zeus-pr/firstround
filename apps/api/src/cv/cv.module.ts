import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module.js';
import { SessionModule } from '../session/session.module.js';
import { CvController } from './cv.controller.js';
import { CvService } from './cv.service.js';

@Module({
  imports: [FilesModule, SessionModule],
  controllers: [CvController],
  providers: [CvService],
  exports: [CvService],
})
export class CvModule {}
