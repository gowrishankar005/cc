package lab.lambdaapigw;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;

import java.util.Map;

/**
 * WDL-1 clean positive case (mirrors a reference AWS SaaS sample's tenant-service):
 * a Lambda handler with NO Dynamo import of its own — delegates entirely
 * to TierStore. Should become a real `service` unit via http-entry-point
 * evidence (implements RequestHandler), never `database`.
 */
public class TierService implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {

    private final TierStore tierStore = new TierStore("lab-tiers");

    public APIGatewayProxyResponseEvent getTiers(APIGatewayProxyRequestEvent input, Context context) {
        tierStore.getAllTiers();
        return new APIGatewayProxyResponseEvent().withStatusCode(200);
    }

    public APIGatewayProxyResponseEvent getTierById(APIGatewayProxyRequestEvent input, Context context) {
        String tierId = input.getPathParameters().get("id");
        tierStore.getTierById(tierId);
        return new APIGatewayProxyResponseEvent().withStatusCode(200);
    }

    @Override
    public APIGatewayProxyResponseEvent handleRequest(APIGatewayProxyRequestEvent input, Context context) {
        return getTiers(input, context);
    }
}
