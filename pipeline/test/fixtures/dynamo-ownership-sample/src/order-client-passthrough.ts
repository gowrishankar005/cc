// T-MR-4 negative case — the real ambiguity this task closes
// (Claim_Register.md's U-persist-import counterexample): this class imports
// DynamoDBClient purely as a method-parameter TYPE, to pass a
// caller-supplied client through to a real store elsewhere. It never
// constructs or holds one of its own, so it must NOT become a database
// unit — the exact shape Q13 already fixed for @prisma/client's
// AccessService, now closed for the composition-ownership case too.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

export class OrderClientPassthrough {
  describeClient(client: DynamoDBClient): string {
    return client.config.region as unknown as string;
  }
}
