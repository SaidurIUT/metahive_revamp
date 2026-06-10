# MetaHive - How to Run

MetaHive is a multiplayer virtual office platform. Everything runs through **Docker Compose** - one command brings up all 11 services.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v4.x+ with Compose V2)
- At least **8 GB RAM** allocated to Docker (the Java services are memory-hungry)
- API keys for the external services you want to use (see Environment Setup below)

## Quick Start

```bash
# 1. Clone the repo
git clone <repo-url> && cd metahive-revamp

# 2. Create your .env file from the example
cp .env.example .env

# 3. Fill in your API keys in .env (see below)

# 4. Start everything
docker compose up --build

# 5. Open the app
# Frontend:  http://localhost:3000
# Keycloak:  http://localhost:8181 (admin / admin)
```

First build takes **10-15 minutes** (Gradle, Maven, npm). Subsequent starts are much faster.

## Environment Setup

Copy `.env.example` to `.env` and fill in the values:

| Variable | Required | Source |
|---|---|---|
| `NEXT_PUBLIC_GEMINI_API_KEY` | Yes | [Google AI Studio](https://aistudio.google.com/apikey) |
| `GEMINI_API_KEY` | Yes | Same key as above (used by RAG service) |
| `NEXT_PUBLIC_IMAGE_LABELING_API_KEY` | Optional | Google Cloud Vision API key |
| `NEXT_PUBLIC_AGORA_APP_ID` | Optional | [Agora Console](https://console.agora.io/) - for proximity video calls |
| `NEXT_PUBLIC_ZEGO_APP_ID` | Optional | [ZegoCloud Console](https://console.zegocloud.com/) - for video meetings |
| `NEXT_PUBLIC_ZEGO_SERVER_SECRET` | Optional | ZegoCloud dashboard |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Optional | [Firebase Console](https://console.firebase.google.com/) - for team chat |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Optional | Firebase project settings |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Optional | Firebase project settings |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Optional | Firebase project settings |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Optional | Firebase project settings |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Optional | Firebase project settings |
| `NEXT_PUBLIC_GITHUB_ORG_PAT` | Optional | GitHub PAT with `project` and `read:org` scopes |
| `DISCORD_TOKEN` | Optional | [Discord Developer Portal](https://discord.com/developers) |
| `DISCORD_GUILD_ID` | Optional | Your Discord server ID |

**Minimum to run:** You only need the Gemini API key. Other services degrade gracefully (video calls, chat, etc. just won't be available).

## Architecture

```
docker compose up  starts:

  Frontend (Next.js)         :3000   ── the web app
  API Gateway (Spring Boot)  :9000   ── routes requests to backend services
  Office Service             :8080   ── offices, teams, members
  User Service               :8082   ── user profiles, Keycloak sync
  Doc Service                :8083   ── documents, file storage
  Project Manager            :9087   ── boards, lists, cards
  Map Service                :9502   ── multiplayer game map (WebSocket)
  RAG Service (Flask)        :5001   ── AI chat with BERT + Gemini
  Discord Bot (Node.js)      :4000   ── Discord integration + Socket.IO
  Keycloak                   :8181   ── authentication (OAuth2/JWT)

  MySQL 8.0                  :3070   ── primary database
  Redis 7                    (internal) ── doc service caching
  MongoDB 7                  (internal) ── discord bot data
```

## First-Time Keycloak Setup

Keycloak auto-imports the `meta` realm from `infra/keycloak/realms/meta-realm.json`. After startup:

1. Go to http://localhost:8181
2. Log in with `admin` / `admin`
3. Switch to the **meta** realm (top-left dropdown)
4. Verify the `metahive` client exists under Clients

Users can self-register through the app's Sign Up button.

## Running Individual Services (Development)

If you want to run only the frontend for development:

```bash
cd apps/frontend
cp ../../.env.example .env.local   # copy and adjust URLs
npm install --legacy-peer-deps
npm run dev
```

The frontend expects the backend at `localhost:9000`. You can either:
- Run the full backend via `docker compose up mysql redis mongo keycloak api-gateway office-service user-service doc-service project-manager map-service rag-service discord-bot`
- Or point env vars at a remote/hosted backend

## Common Issues

**Build fails with OOM:** Increase Docker's memory to 8+ GB in Docker Desktop settings.

**Keycloak won't start:** It depends on MySQL being healthy. If MySQL is slow to start, just wait or run `docker compose up -d mysql` first, then `docker compose up`.

**Frontend shows blank page:** Check browser console. Usually means Keycloak isn't reachable at `localhost:8181` or the API gateway isn't up at `localhost:9000`.

**"Cannot connect to WebSocket":** The map service at `:9502` needs to be running. Check `docker compose logs map-service`.

## Stopping

```bash
docker compose down           # stop containers, keep data
docker compose down -v        # stop and delete all data volumes
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, TailwindCSS, shadcn/ui, Kaboom.js |
| Backend | Spring Boot 3 (Java 21), Gradle multi-project |
| Auth | Keycloak 24 (OAuth2 / OIDC) |
| AI/ML | Google Gemini 2.0 Flash, BERT embeddings, FAISS vector DB |
| Real-time | WebSocket STOMP (game map), Socket.IO (Discord), Agora (video) |
| Video | ZegoCloud (meetings), Agora SDK (proximity calls) |
| Chat | Firebase Firestore (team chat) |
| Databases | MySQL 8, Redis 7, MongoDB 7 |
| DevOps | Docker Compose, multi-stage Dockerfiles |
