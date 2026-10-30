package com.kirana.common;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

/** Builds bounded page requests from query parameters. */
public final class Pages {

    public static final int MAX_SIZE = 100;

    private Pages() {
    }

    public static PageRequest of(Integer page, Integer size, Sort sort) {
        int p = page == null || page < 0 ? 0 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, MAX_SIZE);
        return PageRequest.of(p, s, sort);
    }
}
