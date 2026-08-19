import { Controller } from '@nestjs/common';
import { SQSClient } from '@aws-sdk/client-sqs';

/**
 * Positive case: the only service evidence is a bare NestJS `@Controller`
 * stereotype (framework-bootstrap, no HTTP verb). Combined with a real
 * `@aws-sdk/client-sqs` import this is the messaging half of the
 * weak-service / import-strategy id-scheme collision (decorator unit id is
 * the file path; Graphify import-strategy unit id is `file::ClassName`).
 * Persistence already closed the same mechanism for `@Service` + a driver
 * import (Java); this file is the second instance — TypeScript + messaging.
 */
@Controller()
export class OrdersPublisher {
  private sqs = new SQSClient({ region: 'us-east-1' });
}
