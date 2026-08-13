package example;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
public class WidgetConfiguration {

    @Bean
    public WidgetReadService widgetReadService(JdbcTemplate jdbcTemplate) {
        return new WidgetReadServiceImpl(jdbcTemplate);
    }
}
