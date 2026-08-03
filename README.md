# SportScore: Real-Time Multi-Sport Tracking Application

SportScore is a real-time, multi-sport platform that unifies live scores, standings, fixtures, news, and in-depth player data for **Football, Basketball, Baseball, and Formula 1** in a single, fast, and elegant experience. Beyond following the action, users can ask an **AI assistant** natural-language questions about any sport, and switch on a **Radio Mode** that converts live match events into spoken commentary in real time.

Under the hood, SportScore is a genuinely distributed, cloud-native system. Live data is ingested from the sports provider and streamed through an event-driven pipeline (Azure Event Hub to Azure Functions to Azure SignalR) that pushes updates to the browser the instant they happen, with no polling and no page refresh. This is the same architectural pattern used by production-grade live sports and trading platforms, applied end to end across four independently deployable services.

> **MSc Dissertation Project, COMP47250 Team Software Project**
> **University College Dublin, in collaboration with Microsoft.**
> This project is delivered as a team dissertation and is mentored by both UCD faculty and Microsoft technical staff.

---

## The Problem We Set Out to Solve

Following live sport today is surprisingly fragmented. A single fan interested in more than one sport is forced to jump between several different apps and websites, each with its own layout, its own login, and its own refresh behaviour. Scores are often stale until the page is manually reloaded, official data feeds are expensive or heavily gated, and almost none of these experiences are usable hands-free or by people with visual impairments.

We wanted to fix this. SportScore was born from a simple idea that we cared enough about to build properly: **one place, four sports, updating live, for everyone.**

Concretely, the project tackles three real problems:

1. **Fragmentation.** Instead of switching between apps for Football, Basketball, Baseball, and F1, everything lives in one consistent, responsive interface with a shared design language across every sport.
2. **Latency.** Rather than refreshing to check the score, our event-driven pipeline streams updates to the screen the moment they occur, so the interface always reflects the true state of play.
3. **Accessibility and engagement.** Not everyone can stare at a screen while a match is on. Our **Radio Mode** turns live events into natural spoken commentary, making the platform usable hands-free, while the **AI assistant** lets anyone get answers in plain English instead of hunting through tables and stats pages.

These were not features bolted on for the sake of a rubric. They came from a shared conviction that live sport should be unified, instant, and accessible, and that conviction is what drove the high level of involvement and engineering effort behind this project.

---

## Live Deployment

**Live application:** https://sportscore-realtime-sports-tracking.vercel.app/

The web application is deployed and publicly accessible at the link above. It is backed by the live services running on Microsoft Azure.

---

## Microsoft Collaboration and Mentors

SportScore is a Microsoft-collaborated dissertation project. We gratefully acknowledge the guidance of our Microsoft mentors throughout the project:

- **Rahul Vatsa**
- **Sonia Kaushal**
- **Donncha O'Gorman**

---

## Team

We are a team of five who built SportScore together. While each member led a primary area, the project was a genuinely collaborative effort with shared ownership across the codebase.

| Member | Primary Focus                                                                                                                                                                                                                                                    |
|--------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Hemanathan Sasikala Karthikeyan** (Team Lead) | Backend architecture and per-sport modules (Java, Spring Boot), the live ESPN data pipeline, parts of the Azure Functions streaming layer, the backend test suite, and cloud deployment                                                                          |
| **Katragunta Mahanth Vamsi** | Frontend, live user interface and real-time integration (Next.js, React), and frontend testing                                                                                                                                                                   |
| **Adityanarayanan Buddharajan** | Real-time streaming pipeline (Azure Event Hub, Functions, SignalR),Azure Portal infrastructure management (App Service plan migration, resource configuration), Radio Mode (Azure Neural TTS), and real-time pipeline evaluation via Azure Application Insights  |
| **Aiswarya Anilraj** | AI assistant and Retrieval-Augmented Generation service (Python)                                                                                                                                                                                                 |
| **Shailesh Rajesh** | Security, authentication, and secret management                                                                                                                                                                                                                  |

### How We Worked as a Team

The project was built on **equal effort and shared responsibility**. We met regularly throughout the trimester, tracked our work in sprints, and reviewed each other's contributions before merging. Although each member owned a primary area, everyone contributed across the full stack: reviewing pull requests, debugging integration issues between services, and supporting each other's modules when deadlines were tight.

Our way of working included:
- **Regular team meetings** with clear task assignment and follow-up.
- **Sprint-based planning** aligned to the module milestones and show-and-tell sessions.
- **Consistent use of GitHub** with meaningful, attributable commits spread across the whole project rather than clustered near deadlines.
- **Peer code review** and respect for ownership boundaries, especially for the shared data models used across the backend and the Azure Functions layer.

This collaborative approach kept the four services (backend, functions, RAG, and frontend) in sync and allowed us to integrate them into a single, working real-time platform.

---

## Table of Contents

1. [What It Does](#what-it-does)
2. [Architecture at a Glance](#architecture-at-a-glance)
3. [Tech Stack](#tech-stack)
4. [Repository Structure](#repository-structure)
5. [Getting Started](#getting-started)
6. [Environment Variables](#environment-variables)
7. [Testing](#testing)
8. [Deployment](#deployment)
9. [Security](#security)

---

## What It Does

- **Live scores and match tracking** for Football, Basketball, Baseball, and F1, updated in real time via SignalR with no page refresh.
- **Per-sport sections** with fixtures, standings, league tables, team pages, player pages, injuries, transactions, statistics, and news.
- **Formula 1 module** with driver standings, race schedule, race results, driver and team detail pages, circuit maps, and a season (year) selector.
- **AI Assistant**, a chat sidebar that answers sports questions using a Retrieval-Augmented Generation (RAG) service, backed by both a knowledge corpus and live match data.
- **Radio Mode**, which converts live match events into audio commentary using Azure Speech and streams it to the browser.
- **Security-first design** with encrypted secrets, login rate-limiting and lockout, and a public Security and Privacy page.

---

## Architecture at a Glance

SportScore is made of four independently running services.

```
        ESPN Unofficial API (Football / Basketball / Baseball / F1)
                              |
                              v
   +----------------------------------------------------+
   |  BACKEND: Java 17 / Spring Boot                    |
   |  - REST passthrough for reference data             |
   |  - Live pipeline: polls ESPN every ~30s and        |
   |    publishes in-progress matches to Event Hub      |
   |  - Security (auth, rate limit, encryption)         |
   |  - /api/ask proxies to the RAG service             |
   +----------------------------------------------------+
        | (live matches)                | (REST reference data)
        v                               |
  +------------------+                  |
  | Azure Event Hub  |                  |
  +------------------+                  |
        |                               |
        v                               |
  +----------------------------+        |
  | AZURE FUNCTIONS (Java)     |        |
  | - Event Hub to SignalR     |        |
  | - Radio Mode to Azure      |        |
  |   Speech                   |        |
  +----------------------------+        |
        | (broadcast)                   |
        v                               v
  +------------------+     +-------------------------------+
  | Azure SignalR    | --> |  FRONTEND: Next.js 16 / React |
  +------------------+     |  - Live UI, per-sport pages   |
                           |  - AI Assistant sidebar       |
  +----------------------+ |  - Radio Bar                  |
  | RAG SERVICE (Flask)  |<+  (asks questions via /api/ask)|
  | - Azure OpenAI       | +-------------------------------+
  | - Azure AI Search    |
  | - PostgreSQL/pgvector |
  +----------------------+
```

**In plain terms:**
1. The **backend** pulls sports data from ESPN. Reference data (tables, fixtures, rosters) is served straight to the frontend over REST.
2. For **live** matches, the backend pushes updates into **Azure Event Hub**.
3. **Azure Functions** read from Event Hub and broadcast updates to the browser through **Azure SignalR**, and also generate spoken commentary for **Radio Mode**.
4. The **frontend** shows everything live and lets users ask the **AI Assistant** questions, which are answered by the **RAG service**.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, `@microsoft/signalr`, `motion`, `lucide-react` |
| **Backend** | Java 17, Spring Boot 3.4.5 (Maven), Spring Security, Spring Retry, Spring Data Redis, Jasypt (encryption), Azure Event Hubs SDK |
| **Streaming and Cloud** | Azure Event Hub, Azure Functions (Java), Azure SignalR, Azure Speech, Azure App Service |
| **AI and RAG** | Python, Flask, Azure OpenAI, Azure AI Search, PostgreSQL with pgvector, sentence-transformers |
| **Data source** | ESPN unofficial API |
| **Tooling** | GitHub, Dependabot, Locust (load testing) |

---

## Repository Structure

```
sportscore_realtime_sports_tracking_application/
├── backend/                  Java / Spring Boot service
│   ├── src/main/java/org/Spring/
│   │   ├── Main.java              App entry point
│   │   ├── LivePipelineRunner.java  Polls ESPN and publishes live matches
│   │   ├── football/ basketball/ baseball/ f1/   Per-sport modules
│   │   │   └── (api / adapter / fetcher per sport)
│   │   ├── api/                   ESPN HTTP client and helpers
│   │   ├── consumer/ producer/    Event Hub producer and consumer
│   │   ├── Config/                Security, rate limiting, lockout
│   │   └── Controller/            RAG proxy, security test endpoints
│   ├── rag/                       Python Flask RAG microservice
│   │   ├── app.py                 Flask API (/ask)
│   │   ├── search.py              Retrieval (pgvector and Azure AI Search)
│   │   ├── ingest_corpus_to_postgres.py
│   │   └── *_live_updater.py      Live index updaters per sport
│   ├── loadtest/                  Locust load-testing script
│   └── pom.xml
│
├── functions/                Azure Functions (Java)
│   └── src/main/java/org/sportscore/
│       ├── functions/             EventHub to SignalR, EventHub to Radio Mode
│       ├── radio/                 Commentary and Azure Speech client
│       ├── signalr/               SignalR JWT helper
│       └── model/ validator/
│
├── frontend/                 Next.js app
│   └── src/
│       ├── app/                   Routes: football, basketball, baseball, f1, security
│       ├── components/            UI, per-sport, assistant, radio, charts
│       ├── lib/api/               API clients (espn, f1, rag, signalr)
│       ├── hooks/                 useSignalR, useRadioSignalR
│       └── types/
│
├── Credential Security Architecture.png
└── README.md
```

---

## Getting Started

You will run four services. For local development, start them in this order: RAG service, backend, functions, frontend.

### Prerequisites
- **Java 17** and **Maven**
- **Node.js** (LTS) and **npm**
- **Python 3.10+**
- Access to the relevant **Azure resources** (Event Hub, SignalR, OpenAI, AI Search, Speech) and a **PostgreSQL** instance with the `pgvector` extension

### 1. Backend (Spring Boot)
```bash
cd backend
# Create a backend/.env file with the required keys (see Environment Variables)
./mvnw spring-boot:run
```
Runs on `http://localhost:8081` by default.

### 2. RAG Service (Flask)
```bash
cd backend/rag
python -m venv venv && source venv/bin/activate   # (Windows: venv\Scripts\activate)
pip install -r requirements.txt
# One-time: build the knowledge corpus table
python ingest_corpus_to_postgres.py
python app.py
```
Runs on `http://localhost:5000`. The backend proxies `/api/ask` to this service.

### 3. Azure Functions
```bash
cd functions
mvn clean package
mvn azure-functions:run
```

### 4. Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000`.

> Tip: if the frontend build fails after fixing an error, clear the cache with `rm -rf .next` and run `npm run dev` again, because Next.js caches failed compilations.

---

## Environment Variables

Secrets are never committed. The files `.env`, `.env.local`, and `application.properties` are all git-ignored. Create these files locally.

### `backend/.env`
```
APP_ADMIN_USER=...
APP_ADMIN_PASS=...
APP_USER_NAME=...
APP_USER_PASS=...
SIGNALR_CONNECTION_STRING=...
SIGNALR_HUB=...
EVENTHUB_CONNECTION_STRING=...
EVENTHUB_NAME=...
JASYPT_ENCRYPTOR_PASSWORD=...
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

### `backend/rag/.env`
```
AZURE_OPENAI_KEY=...
AZURE_OPENAI_ENDPOINT=...
AZURE_OPENAI_DEPLOYMENT=...
AZURE_SEARCH_ENDPOINT=...
AZURE_SEARCH_KEY=...
POSTGRES_HOST=...
POSTGRES_PORT=...
POSTGRES_DB=...
POSTGRES_USER=...
POSTGRES_PASSWORD=...
```

### `frontend/.env.local`
```
NEXT_PUBLIC_API_BASE=http://localhost:8081
NEXT_PUBLIC_F1_API_BASE=http://localhost:8081
NEXT_PUBLIC_JAVA_API_BASE=http://localhost:8081
NEXT_PUBLIC_SIGNALR_ENDPOINT=...
NEXT_PUBLIC_SIGNALR_HUB=sportscoreHub
SIGNALR_ENDPOINT=...
SIGNALR_ACCESS_KEY=...
SIGNALR_HUB=...
SIGNALR_RADIO_HUB=...
```

> The app is designed to fail closed. If configuration is missing it will not silently connect to real infrastructure.

---

## Testing

Testing was a first-class part of the project, not an afterthought. We combined automated unit and integration tests with realistic load testing.

### Backend (JUnit, around 59 test cases)
The Spring Boot backend is covered by unit and integration tests across every sport module and the shared infrastructure, including:
- **Controller tests** for Football, Basketball, Baseball, and F1, verifying endpoint behaviour and response mapping.
- **Adapter and parsing tests** that confirm ESPN payloads are correctly transformed into our domain models.
- **F1 standings tests** that lock in tricky behaviour such as the monotonic points guard, the stable standings cache, and correct handling of historical seasons versus the current season.
- **HTTP client retry tests** validating that transient upstream failures are retried correctly.
- **Event Hub producer tests** for the live publishing path.
- **Model serialization tests** for the shared match model.

Run the backend test suite:
```bash
cd backend
./mvnw test
```

### Azure Functions (JUnit)
The Radio Mode commentary generation is unit tested, covering how team names are chosen and how kickoff and match events are turned into readable commentary text.
```bash
cd functions
mvn test
```

### RAG Service (Python)
A retrieval smoke test validates that queries return relevant results from the search index.
```bash
cd backend/rag
python test_query.py
```

### Load Testing (Locust)
We stress-tested the backend under concurrent user load using a Locust script that simulates realistic browsing behaviour, weighting the most common endpoints (for example football scoreboard and standings) more heavily than rarer ones. This let us confirm the live pipeline and API held up under sustained traffic.
```bash
cd backend/loadtest
locust -f locustfile.py --host https://sportscore-backend-ecaue6buc5bwf7at.northeurope-01.azurewebsites.net
```

---

## Deployment

SportScore is fully deployed and publicly accessible.

- **Frontend (Next.js)** is deployed on **Vercel**: https://sportscore-realtime-sports-tracking.vercel.app/
- **Backend, live pipeline, and AI services** are deployed on **Microsoft Azure**, using Azure App Service, Azure Functions, Azure Event Hub, Azure SignalR, Azure OpenAI, Azure AI Search, and Azure Speech.

---

## Security

Security was designed in from the start, in line with the credential-handling approach shown in `Credential Security Architecture.png`.

- **Secrets encrypted at rest** with Jasypt, with no credentials committed to source control.
- **Login protection** through rate limiting and account lockout on repeated failed attempts.
- **Hardened HTTP headers and a strict Content Security Policy** configured in the frontend (`next.config.js`).
- **No user tracking and no ads**, as described on the in-app Security and Privacy page.
- **Continuous dependency scanning** via GitHub Dependabot.

---

*This project was created as an MSc dissertation for the COMP47250 Team Software Project module at University College Dublin, in collaboration with Microsoft.*
