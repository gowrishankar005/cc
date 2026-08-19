import { Controller, Get } from '@nestjs/common';
import { SQSClient } from '@aws-sdk/client-sqs';

/**
 * Negative case: a real HTTP entry point that also imports the SQS client.
 * Must stay a single service unit (existingServiceFilePaths skip), never a
 * second topic node and never flipped to topic-kind. Same tradeoff
 * detectPersistencePass already makes for a Controller that imports an ORM.
 */
@Controller('orders')
export class OrdersApi {
  private sqs = new SQSClient({ region: 'us-east-1' });

  @Get()
  list(): string {
    return '[]';
  }
}
