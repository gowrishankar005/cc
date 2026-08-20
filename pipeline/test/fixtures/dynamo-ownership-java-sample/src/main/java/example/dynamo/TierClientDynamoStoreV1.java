package example.dynamo;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDBClientBuilder;

/**
 * T-MR-4 positive case — genuinely owns the AWS SDK v1 Dynamo client as a
 * field. Must remain a real `database` unit. Second, different instance of
 * the same ownership-shape mechanism as the Node/TS fixture (different
 * language, different AWS SDK generation).
 */
public class TierClientDynamoStoreV1 {

    private final AmazonDynamoDB dynamoDb = AmazonDynamoDBClientBuilder.defaultClient();

    public void putTier(String tierId) {
        dynamoDb.toString();
    }
}
