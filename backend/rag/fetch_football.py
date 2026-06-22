import requests
import json
import time

# ── CONFIG ──────────────────────────────────────────────
API_KEY = "3c4567049053d8e049d531f872a2a107"
BASE_URL = "https://v3.football.api-sports.io"
HEADERS = {"x-apisports-key": API_KEY}

OUTPUT_FILE = "corpus/football_corpus.json"

# We will fetch data for the Premier League
# League ID 39 = Premier League, Season 2024
LEAGUE_ID = 39
SEASON = 2024

corpus = []  # this list will hold all our entries

# ── HELPER: make API call ────────────────────────────────
def call_api(endpoint, params={}):
    url = f"{BASE_URL}/{endpoint}"
    response = requests.get(url, headers=HEADERS, params=params)
    data = response.json()
    return data.get("response", [])

# ── PART 1: FETCH TOP PLAYERS ────────────────────────────
# We fetch top scorers for Premier League 2024
# This uses only 1 API request
print("Fetching top scorers...")
players = call_api("players/topscorers", {"league": LEAGUE_ID, "season": SEASON})

for item in players:
    p = item.get("player", {})
    stats = item.get("statistics", [{}])[0]

    player_id   = p.get("id", "")
    name        = p.get("name", "Unknown")
    nationality = p.get("nationality", "Unknown")
    age         = p.get("age", "Unknown")
    height      = p.get("height", "Unknown")
    weight      = p.get("weight", "Unknown")
    position    = stats.get("games", {}).get("position", "Unknown")
    team_name   = stats.get("team", {}).get("name", "Unknown")
    league_name = stats.get("league", {}).get("name", "Unknown")
    appearances = stats.get("games", {}).get("appearences", 0)
    minutes     = stats.get("games", {}).get("minutes", 0)
    goals       = stats.get("goals", {}).get("total", 0)
    assists     = stats.get("goals", {}).get("assists", 0)
    yellow      = stats.get("cards", {}).get("yellow", 0)
    red         = stats.get("cards", {}).get("red", 0)

    content = (
        f"{name} is a {nationality} footballer aged {age}. "
        f"They play as a {position} for {team_name} in the {league_name}. "
        f"Height: {height}, Weight: {weight}. "
        f"In the {SEASON} season, they made {appearances} appearances "
        f"totalling {minutes} minutes, scoring {goals} goals and providing "
        f"{assists} assists. Cards: {yellow} yellow, {red} red."
    )

    entry = {
        "id": f"football-player-{player_id}",
        "sport": "football",
        "category": "player",
        "title": f"{name} — Player Profile",
        "content": content,
        "tags": [name, nationality, team_name, position, league_name],
        "source": "api-football.com",
        "source_id": player_id,
        "last_updated": f"{SEASON}-season"
    }
    corpus.append(entry)

print(f" Got {len(players)} players")
time.sleep(1)  # be polite to the API

# ── PART 1B: FETCH TOP ASSISTS ───────────────────────────
print("Fetching top assists...")
assist_players = call_api("players/topassists", {"league": LEAGUE_ID, "season": SEASON})

for item in assist_players:
    p = item.get("player", {})
    stats = item.get("statistics", [{}])[0]

    player_id   = p.get("id", "")
    name        = p.get("name", "Unknown")

    # Skip if this player was already added from top scorers
    if any(entry["source_id"] == player_id and entry["category"] == "player" for entry in corpus):
        continue

    nationality = p.get("nationality", "Unknown")
    age         = p.get("age", "Unknown")
    height      = p.get("height", "Unknown")
    weight      = p.get("weight", "Unknown")
    position    = stats.get("games", {}).get("position", "Unknown")
    team_name   = stats.get("team", {}).get("name", "Unknown")
    league_name = stats.get("league", {}).get("name", "Unknown")
    appearances = stats.get("games", {}).get("appearences", 0)
    minutes     = stats.get("games", {}).get("minutes", 0)
    goals       = stats.get("goals", {}).get("total", 0)
    assists     = stats.get("goals", {}).get("assists", 0)
    yellow      = stats.get("cards", {}).get("yellow", 0)
    red         = stats.get("cards", {}).get("red", 0)

    content = (
        f"{name} is a {nationality} footballer aged {age}. "
        f"They play as a {position} for {team_name} in the {league_name}. "
        f"Height: {height}, Weight: {weight}. "
        f"In the {SEASON} season, they made {appearances} appearances "
        f"totalling {minutes} minutes, scoring {goals} goals and providing "
        f"{assists} assists. Cards: {yellow} yellow, {red} red."
    )

    entry = {
        "id": f"football-player-{player_id}",
        "sport": "football",
        "category": "player",
        "title": f"{name} — Player Profile",
        "content": content,
        "tags": [name, nationality, team_name, position, league_name],
        "source": "api-football.com",
        "source_id": player_id,
        "last_updated": f"{SEASON}-season"
    }
    corpus.append(entry)

print(f" Got {len(assist_players)} assist leaders (new ones added)")
time.sleep(1)

# ── PART 2: FETCH STANDINGS (team info + league position) ─
# This uses only 1 API request
print("Fetching standings...")
standings_data = call_api("standings", {"league": LEAGUE_ID, "season": SEASON})

if standings_data:
    table = standings_data[0].get("league", {}).get("standings", [[]])[0]

    for row in table:
        team        = row.get("team", {})
        team_id     = team.get("id", "")
        team_name   = team.get("name", "Unknown")
        rank        = row.get("rank", "?")
        points      = row.get("points", 0)
        played      = row.get("all", {}).get("played", 0)
        win         = row.get("all", {}).get("win", 0)
        draw        = row.get("all", {}).get("draw", 0)
        lose        = row.get("all", {}).get("lose", 0)
        goals_for   = row.get("all", {}).get("goals", {}).get("for", 0)
        goals_ag    = row.get("all", {}).get("goals", {}).get("against", 0)
        goal_diff   = row.get("goalsDiff", 0)
        form        = row.get("form", "N/A")
        description = row.get("description", "")

        content = (
            f"{team_name} finished {rank} in the Premier League {SEASON} season "
            f"with {points} points from {played} games "
            f"({win} wins, {draw} draws, {lose} losses). "
            f"Goals scored: {goals_for}, Goals conceded: {goals_ag}, "
            f"Goal difference: {goal_diff}. "
            f"Recent form: {form}. "
            f"Status: {description}." if description else
            f"{team_name} finished {rank} in the Premier League {SEASON} season "
            f"with {points} points from {played} games "
            f"({win} wins, {draw} draws, {lose} losses). "
            f"Goals scored: {goals_for}, Goals conceded: {goals_ag}, "
            f"Goal difference: {goal_diff}. Recent form: {form}."
        )

        entry = {
            "id": f"football-team-{team_id}",
            "sport": "football",
            "category": "team",
            "title": f"{team_name} — Premier League {SEASON} Season",
            "content": content,
            "tags": [team_name, "Premier League", "standings", str(SEASON)],
            "source": "api-football.com",
            "source_id": team_id,
            "last_updated": f"{SEASON}-season"
        }
        corpus.append(entry)

    print(f"  Got {len(table)} teams from standings")

time.sleep(1)

# ── PART 3: ADD COMPETITION FORMAT (manual — no API needed) ─
print("Adding competition format entries...")

competition_entries = [
    {
        "id": "football-competition-001",
        "sport": "football",
        "category": "competition",
        "title": "Premier League — Format and Rules",
        "content": (
            "The Premier League is the top division of English football, "
            "featuring 20 clubs. Each team plays 38 matches per season "
            "(home and away against every other team). Teams receive 3 points "
            "for a win, 1 for a draw, and 0 for a loss. The team with the most "
            "points at the end of the season wins the title. The bottom 3 teams "
            "are relegated to the Championship. The top 4 teams qualify for the "
            "UEFA Champions League. Teams finishing 5th and 6th qualify for the "
            "UEFA Europa League. The league runs from August to May each year."
        ),
        "tags": ["Premier League", "format", "relegation", "Champions League", "football"],
        "source": "premierleague.com",
        "source_id": 39,
        "last_updated": "2024-season"
    },
    {
        "id": "football-competition-002",
        "sport": "football",
        "category": "competition",
        "title": "UEFA Champions League — Format",
        "content": (
            "The UEFA Champions League is Europe's premier club football competition. "
            "From the 2024-25 season, the format changed to a league phase with 36 clubs, "
            "each playing 8 matches against different opponents. The top 8 teams advance "
            "directly to the Round of 16. Teams finishing 9th to 24th enter a knockout "
            "playoff round. Teams finishing 25th or below are eliminated. "
            "The competition then follows a standard knockout format through "
            "Round of 16, Quarter-finals, Semi-finals, and the Final."
        ),
        "tags": ["Champions League", "UEFA", "format", "European football"],
        "source": "uefa.com",
        "source_id": 2,
        "last_updated": "2024-season"
    },
    {
        "id": "football-competition-003",
        "sport": "football",
        "category": "competition",
        "title": "FIFA World Cup — Format",
        "content": (
            "The FIFA World Cup is held every four years and is the most prestigious "
            "international football tournament. 32 teams (expanding to 48 from 2026) "
            "compete across a group stage and knockout rounds. In the group stage, "
            "teams are divided into groups of 4, with the top 2 from each group "
            "advancing to the Round of 16. The tournament then follows a straight "
            "knockout format through Quarter-finals, Semi-finals, Third place play-off, "
            "and the Final. The 2026 World Cup will be hosted by USA, Canada, and Mexico."
        ),
        "tags": ["World Cup", "FIFA", "format", "international football"],
        "source": "fifa.com",
        "source_id": 1,
        "last_updated": "2024"
    } 
]

corpus.extend(competition_entries)
print(f"  Added {len(competition_entries)} competition entries")

# ── SAVE TO FILE ─────────────────────────────────────────
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(corpus, f, indent=2, ensure_ascii=False)

print(f"\nDone! Total entries: {len(corpus)}")
print(f"Saved to: {OUTPUT_FILE}")