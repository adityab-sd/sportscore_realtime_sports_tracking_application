// Save at: frontend/scripts/send-test-event.js
// Requires: npm install @azure/event-hubs   (run from frontend/)
// Run with: node scripts/send-test-event.js
//
// Payload shape matches org.sportscore.model.Match / Team / MatchEvent exactly
// (confirmed against Match.java, Team.java, MatchEvent.java). teamId on the
// event must match one of the two team ids below, or CommentaryService falls
// back to the generic "the team" phrase instead of naming a side.

const { EventHubProducerClient } = require("@azure/event-hubs");

const connectionString = "Endpoint=sb://sportscore-eventhub.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=g1SawBVMekY0C5gjPj0EAxWZULxhDJvBt+AEhPjRvFw="; // needs Send rights
const eventHubName = "sportscore-eventhub-2";

async function main() {
  const producer = new EventHubProducerClient(connectionString, eventHubName);
  const batch = await producer.createBatch();

  const payload = [{
    id: 999001,
    sport: "football",
    status: "live",
    elapsed: 34,
    clock: "34:00",
    period: 2,
    statusDetail: null,
    kickoff: new Date().toISOString(),
    competition: "Test League",
    homeTeam: { id: 1, name: "Test FC", shortName: "TFC", logo: "" },
    awayTeam: { id: 2, name: "Test United", shortName: "TUN", logo: "" },
    homeScore: 1,
    awayScore: 0,
    homeScoreDisplay: "1",
    awayScoreDisplay: "0",
    events: [{
      minute: 34,
      type: "GOAL",
      detail: null,
      player: "J. Smith",
      assist: "A. Jones",
      teamId: 1
    }]
  }];

  batch.tryAdd({ body: JSON.stringify(payload) });
  await producer.sendBatch(batch);
  await producer.close();
  console.log("Sent test event");
}

main().catch(console.error);