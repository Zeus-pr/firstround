import { Injectable, Logger } from '@nestjs/common';
import { formatAuditLog, type AuditEventInput } from './log.js';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  record(event: AuditEventInput) {
    this.logger.log(formatAuditLog(event));
  }
}
