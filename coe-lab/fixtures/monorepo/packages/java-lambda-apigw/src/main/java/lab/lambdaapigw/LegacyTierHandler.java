package lab.lambdaapigw;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;

/**
 * WDL-2 disconfirming case (mirrors a reference AWS SaaS sample's tier-service,
 * HT-ASB-002): a Lambda handler that ALSO owns its own DynamoDbClient
 * field directly, not just a store class it delegates to. Real bug this
 * fixture exists to catch: before Y2's kind-priority fix, this class would
 * be typed `database` (bare driver-import signal), even though it is
 * architecturally a handler with real http-entry-point evidence
 * (implements RequestHandler) that should win the kind tie-break.
 */
public class LegacyTierHandler implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {

    private final DynamoDbClient dynamoDbClient = DynamoDbClient.builder().build();

    public APIGatewayProxyResponseEvent updateTier(APIGatewayProxyRequestEvent input, Context context) {
        return new APIGatewayProxyResponseEvent().withStatusCode(200);
    }

    @Override
    public APIGatewayProxyResponseEvent handleRequest(APIGatewayProxyRequestEvent input, Context context) {
        return updateTier(input, context);
    }
}
