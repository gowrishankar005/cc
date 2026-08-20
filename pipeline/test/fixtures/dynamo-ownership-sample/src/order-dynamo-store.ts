// T-MR-4 positive case — genuinely owns the DynamoDB client as a field
// (constructs it directly, same real idiom as the ts-orders-dynamo lab
// fixture's OrdersDynamoStore). Must remain a real `database` unit.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

export class OrderDynamoStore {
  private dynamo = new DynamoDBClient({ region: 'us-east-1' });

  async putOrder(order: { id: string }) {
    return order;
  }
}
