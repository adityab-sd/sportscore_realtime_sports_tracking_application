package org.Spring.adapter;

import com.fasterxml.jackson.databind.JsonNode;
import org.Spring.model.Match;

import java.util.List;

public interface ScoreboardAdapter {

    List<Match> toMatches(JsonNode root, String leagueName) throws Exception;

}
