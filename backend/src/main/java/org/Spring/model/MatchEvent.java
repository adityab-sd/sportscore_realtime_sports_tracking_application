package org.Spring.model;

public record MatchEvent(
        int minute,
        String type,
        String detail,
        String player,
        String assist,
        int teamId
) {}