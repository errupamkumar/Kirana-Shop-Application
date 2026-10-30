package com.kirana.common;

import java.time.ZoneId;

public final class TimeZones {

    /** Business day boundaries (order numbers, dashboard "today") use India time. */
    public static final ZoneId STORE = ZoneId.of("Asia/Kolkata");

    private TimeZones() {
    }
}
