from locust import HttpUser, task, between


class SportScoreUser(HttpUser):
    # Each simulated user waits 1-3 seconds between actions,
    # mimicking a real person browsing rather than a raw flood.
    wait_time = between(1, 3)

    # The numbers in @task(n) are weights: football is hit ~3x as often as baseball.
    # The name="..." groups each endpoint neatly in the Locust results table.

    @task(3)
    def football_scoreboard(self):
        self.client.get("/api/football/eng.1/scoreboard", name="football scoreboard")

    @task(2)
    def football_standings(self):
        self.client.get("/api/football/eng.1/standings", name="football standings")

    @task(2)
    def basketball_scoreboard(self):
        self.client.get("/api/basketball/nba/scoreboard", name="basketball scoreboard")

    @task(1)
    def baseball_scoreboard(self):
        self.client.get("/api/baseball/mlb/scoreboard", name="baseball scoreboard")

    @task(2)
    def f1_standings(self):
        # Watch this one's latency vs the others — the per-driver N+1 issue would
        # show up here as a noticeably slower 95th-percentile response time.
        self.client.get("/api/f1/standings", name="f1 standings")

    @task(1)
    def f1_scoreboard(self):
        self.client.get("/api/f1/scoreboard", name="f1 scoreboard")