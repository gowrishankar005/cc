package lab.settlement;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

/**
 * Lab fixture — settlement events via Kafka (fintech event-driven pattern).
 */
@Component
public class SettlementListener {

    private final KafkaTemplate<String, String> kafkaTemplate;

    public SettlementListener(KafkaTemplate<String, String> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    @KafkaListener(topics = "settlement.completed")
    public void onSettlement(String payload) {
        // process settlement
    }

    public void publish(String payload) {
        kafkaTemplate.send("settlement.completed", payload);
    }
}
