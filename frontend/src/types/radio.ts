// Mirrors RadioModeAudioMessage (EventHubToRadioModeFunction.java) field-for-field.
// This is what arrives over the "radioModeEvent" SignalR method on radioModeHub.
export interface RadioAudioEvent {
  matchId: number;
  sport: string; // e.g. "football" | "basketball" - stamped from Match.sport() on the backend
  eventType: string;
  minute: number;
  text: string;
  audioBase64: string;
  contentType: string; // e.g. "audio/mpeg"
  synthLatencyMs: number; // matches RadioModeAudioMessage.synthLatencyMs exactly (Jackson serializes by field name)
}