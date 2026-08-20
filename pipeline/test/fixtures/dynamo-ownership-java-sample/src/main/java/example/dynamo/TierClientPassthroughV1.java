package example.dynamo;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;

/**
 * T-MR-4 negative case — imports AmazonDynamoDB purely as a method
 * parameter TYPE, to pass a caller-supplied client through. Never
 * constructs or holds one of its own, so must NOT become a database unit —
 * the same real ambiguity as the Node/TS fixture's OrderClientPassthrough.
 */
public class TierClientPassthroughV1 {

    public String describeClient(AmazonDynamoDB client) {
        return client.toString();
    }
}
