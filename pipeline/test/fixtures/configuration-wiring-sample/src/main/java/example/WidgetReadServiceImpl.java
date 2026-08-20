package example;

import org.springframework.jdbc.core.JdbcTemplate;

public class WidgetReadServiceImpl implements WidgetReadService {

    private final JdbcTemplate jdbcTemplate;

    public WidgetReadServiceImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public java.util.List<String> findAll() {
        return jdbcTemplate.queryForList("select name from widget", String.class);
    }
}
