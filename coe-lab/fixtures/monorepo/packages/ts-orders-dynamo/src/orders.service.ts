/**
 * Lab fixture — cloud-native order store (Fidelity-aligned AWS patterns).
 * Real @aws-sdk packages are not required at install time; import paths are
 * the detection signal for the platform catalogue.
 */

// Detection targets (import names matter for Graphify/persistence strategies)
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

export class OrdersDynamoStore {
  private dynamo = new DynamoDBClient({ region: 'us-east-1' });
  private sqs = new SQSClient({ region: 'us-east-1' });

  async putOrder(order: { id: string }) {
    return order;
  }

  async enqueue(orderId: string) {
    await this.sqs.send(
      new SendMessageCommand({
        QueueUrl: 'https://sqs.example/orders',
        MessageBody: orderId,
      })
    );
  }
}

// Minimal HTTP surface for service detection
import { createServer } from 'http';

export function startOrdersApi() {
  return createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/orders') {
      res.end('[]');
      return;
    }
    if (req.method === 'POST' && req.url === '/orders') {
      res.statusCode = 201;
      res.end('{}');
      return;
    }
    res.statusCode = 404;
    res.end();
  });
}
