
from locust import HttpUser, task, between


class SportScoreUser(HttpUser):
    # Each simulated user waits 1-3 seconds between actions,
    # mimicking a real person browsing rather than a raw flood.
    wait_time = between(1, 3)

    @task(3)
    def get_football(self):
        self.client.get("/api/football")

    @task(2)
    def get_basketball(self):
        self.client.get("/api/basketball")

    @task(1)
    def get_baseball(self):
        self.client.get("/api/baseball")