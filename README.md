# MetaHive

MetaHive is a multiplayer virtual office platform with a Next.js web app, Spring Boot microservices, a WebSocket map service, Keycloak auth, Discord integration, and a local RAG assistant.

## Project Layout

```text
apps/
  frontend/        Next.js client
  discord-bot/     Express, Socket.IO, Discord backend
services/
  backend/         Spring Boot services and multiplayer map service
  rag-service/     Flask RAG service
infra/
  keycloak/        Realm import and custom theme
docs/              Product and requirement docs
docker-compose.yml Single local orchestration entry point
```

## Run Everything

```bash
cp .env.example .env
docker compose up --build
```

Then open:

- App: http://localhost:3000
- API gateway: http://localhost:9000
- Keycloak: http://localhost:8181
- RAG service: http://localhost:5001
- Discord backend: http://localhost:4000

The local Keycloak admin user is `admin` / `admin`. The imported realm is `meta`, and the frontend client is `metahive`.

## Environment

The root `.env` file is only needed for optional integrations:

```bash
DISCORD_TOKEN=
DISCORD_GUILD_ID=
GEMINI_API_KEY=
JWT_SECRET=dev-local-secret
```

The Compose file already injects the local frontend URLs:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:9000
NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8181
NEXT_PUBLIC_KEYCLOAK_REALM=meta
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=metahive
NEXT_PUBLIC_MAP_WS_URL=http://localhost:9502/ws
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_RAG_BASE_URL=http://localhost:5001
```

RAG is exposed on host port `5001` because macOS often keeps port `5000` occupied. Inside Docker it still runs on port `5000`.

## Useful Commands

```bash
docker compose ps
docker compose logs -f frontend api-gateway
docker compose down
docker compose down -v
```

Use `docker compose down -v` only when you intentionally want to reset local MySQL, Redis, Mongo, uploaded files, and RAG index data.
