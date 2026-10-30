package com.kirana.order;

import com.kirana.common.TimeZones;
import java.sql.Date;
import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** KS-yyyyMMdd-0001, numbered per India-time day using an atomic upsert on order_sequences. */
@Component
@RequiredArgsConstructor
public class OrderNumberGenerator {

    private static final DateTimeFormatter DAY = DateTimeFormatter.BASIC_ISO_DATE;

    private final JdbcTemplate jdbc;
    private final Clock clock;

    @Transactional(propagation = Propagation.MANDATORY)
    public String next() {
        LocalDate today = LocalDate.now(clock.withZone(TimeZones.STORE));
        jdbc.update("INSERT INTO order_sequences (seq_date, last_seq) VALUES (?, LAST_INSERT_ID(1)) "
                + "ON DUPLICATE KEY UPDATE last_seq = LAST_INSERT_ID(last_seq + 1)", Date.valueOf(today));
        Integer seq = jdbc.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
        return "KS-" + today.format(DAY) + "-" + String.format("%04d", seq);
    }
}
