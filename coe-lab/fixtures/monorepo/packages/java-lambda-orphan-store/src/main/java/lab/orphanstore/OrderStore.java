package lab.orphanstore;

import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;

/**
 * T-Y5-1 fixture — a real Dynamo store class with NO handler/entry-point
 * anywhere in this package root at all. Deliberately generic (not tied to
 * any sample repo name) — this is a standalone S5 completeness-flag
 * fixture, not a mirror of a specific real hard-test finding the way
 * java-lambda-apigw is.
 */
public class OrderStore {

    private final DynamoDbClient dynamoDbClient = DynamoDbClient.builder().build();

    public void getOrder(String orderId) {
        dynamoDbClient.getItem(GetItemRequest.builder().tableName("orders").build());
    }
}
