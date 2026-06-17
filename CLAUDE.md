# LoL Tracker — Agent Guide

Live site: http://13.58.213.244/

A League of Legends companion app with three tabs: Draft simulator, Pro scene data, and a custom amateur League tracker.

## Architecture

Monorepo with two independent packages:

- **`client/`** — React 18 + TypeScript + Vite (port 5173 in dev)
- **`server/`** — Express 5 + TypeScript + Node.js (port 3001 in dev)

The client talks to the server via `VITE_API_URL` (defaults to `http://localhost:3001`). Production runs on an AWS EC2 instance at `13.58.213.244`.

## Dev Commands

Run these from their respective directories:

```bash
# Client
cd client && npm run dev      # Vite dev server on :5173
cd client && npm run build    # tsc + Vite production build
cd client && npm run lint

# Server
cd server && npm run dev      # nodemon + ts-node (hot reload)
cd server && npm run build    # tsc → dist/
cd server && npm start        # Run compiled dist/index.js (production)
```

## Key Data Sources

| Source | How accessed | Used for |
|---|---|---|
| Lolesports API | REST API with `LOLESPORTS_API_KEY` in `server/.env` | Leagues, results, standings, upcoming matches |
| gol.gg | Cheerio scrape | Pro champion pick/ban/winrate stats |
| Lolalytics | Cheerio scrape | Champion counter matchup data |
| DDragon | Public REST API | Champion list, image assets, versioning |
| Google Sheets | CSV export URL (public) | Amateur league match history, standings, stats |
| `server/data/pro-drafts.json` | Static JSON file (~2MB) | Historical pro draft sequences |

`server/scripts/fetch-drafts.js` is a one-off Node script to refresh `pro-drafts.json` by scraping lol.fandom.com. Run manually when new tournament data is needed.

## Server Patterns

**Caching** — `server/src/cache.ts` provides a simple in-memory TTL cache. All external calls go through `cached<T>(key, fn, ttlMs)`. Typical TTLs: 5 min (live match data), 30 min (champion stats), 15 min (Google Sheets).

**Logging** — Winston logger in `server/src/logger.ts`. Console + rolling file logs at `server/logs/server.log`. Use `logger.error(...)` in route error handlers.

**CORS** — Hardcoded origins in `server/src/index.ts`: `localhost:5173` (dev) and `13.58.213.244` (prod EC2).

## Client Structure

```
client/src/
├── api/riot.ts              # DDragon version loading (auto-detects latest patch)
├── components/
│   ├── draft/
│   │   ├── DraftTab.tsx     # 20-step official draft order, phase tracking, undo
│   │   ├── ChampionGrid.tsx # Searchable/filterable champion picker
│   │   └── CounterPanel.tsx # Counter lookup from Lolalytics API
│   ├── EsportsTab.tsx       # Pro leagues, results, standings, upcoming, champ stats
│   ├── LeagueTab.tsx        # Amateur league standings, match history, player stats
│   └── ProMatchesTab.tsx    # Historical pro draft browser + Prio Picks view
├── types.ts                 # Shared types (ChampionData, DraftState, DraftAction)
├── App.tsx                  # Tab navigation, DDragon version loading on mount
├── App.css
├── Draft.css
└── ProMatches.css
```

## Server Routes

| Route | Description |
|---|---|
| `GET /api/esports/leagues` | Featured league list |
| `GET /api/esports/results/:leagueId` | Recent match results + standings |
| `GET /api/esports/upcoming/:leagueId` | Next 10 unstarted matches |
| `GET /api/esports/champstats/:leagueId` | Champion stats scraped from gol.gg |
| `GET /api/matchups/:champion` | Counter data from Lolalytics (worst counters or best matchups) |
| `GET /api/league/overview` | Match history + standings from Google Sheets CSV |
| `GET /api/league/champstats` | Champion stats from Google Sheets CSV |
| `GET /api/league/players` | Per-player stats from Google Sheets CSV |
| `GET /api/promatches/games?page=:page` | Pro draft data from static JSON, paged by tournament label |

## Notes

- No database — data is either live-fetched/scraped, cached in memory, or served from the static `pro-drafts.json`.
- The gol.gg scraper has a champion name override map in `server/src/routes/esports.ts` to bridge gol.gg filenames to DDragon IDs (e.g., "MonkeyKing" → "Wukong").
- `CounterPanel.tsx` behaves differently by phase: ban phase → shows best matchups (what to pick into), pick phase → shows counters (what beats this pick).
- DDragon version falls back to `14.24.1` if the versions API is unreachable.
