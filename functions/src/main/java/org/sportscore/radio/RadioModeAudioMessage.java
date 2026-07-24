package org.sportscore.radio;

/**
 * What gets sent to the "radioModeEvent" SignalR target. audioBase64 is the
 * synthesized clip; for production traffic you'd likely swap this for a
 * short-lived Blob Storage SAS URL instead of inlining the audio bytes, to
 * keep the SignalR message size down -- left as base64 here to keep this
 * pass self-contained.
 *
 * `sport` is stamped from the source Match.sport() so the frontend can filter
 * commentary by section (Football page vs Basketball page) without having to
 * cross-reference matchId against a separately-fetched live match list, which
 * may not contain the match yet (or ever, e.g. for test/synthetic events).
 */
public class RadioModeAudioMessage {

    public int matchId;
    public String sport;
    public String eventType;
    public int minute;
    public String text;
    public String audioBase64;
    public String contentType;
    public long synthLatencyMs;

    public RadioModeAudioMessage() {
        // needed for Jackson
    }

    public RadioModeAudioMessage(int matchId, String sport, String eventType, int minute,
                                 String text, String audioBase64, String contentType,
                                 long synthLatencyMs) {
        this.matchId = matchId;
        this.sport = sport;
        this.eventType = eventType;
        this.minute = minute;
        this.text = text;
        this.audioBase64 = audioBase64;
        this.contentType = contentType;
        this.synthLatencyMs = synthLatencyMs;
    }
}