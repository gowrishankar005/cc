package lab.lambdaapigw;

import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.GetItemResponse;

import java.util.List;
import java.util.Map;

/**
 * Real database owner — constructs and holds the DynamoDbClient as its own
 * field, never delegates ownership further. Distinct from TierService (a
 * handler that merely passes a client through) and LegacyTierHandler (a
 * handler that owns its OWN client directly — the WDL-2 disconfirming case).
 */
public class TierStore {

    private final DynamoDbClient dynamoDbClient;
    private final String tableName;

    public TierStore(String tableName) {
        this.dynamoDbClient = DynamoDbClient.builder().build();
        this.tableName = tableName;
    }

    public List<Map<String, Object>> getAllTiers() {
        return List.of();
    }

    public GetItemResponse getTierById(String tierId) {
        GetItemRequest request = GetItemRequest.builder()
                .tableName(tableName)
                .build();
        return dynamoDbClient.getItem(request);
    }
}
