# LoL Tracker

A League of Legends companion app built with React, TypeScript, and Express.

## Tabs

**Draft** — Full pick/ban simulator following the official draft order. Search and filter champions by class, undo picks, and look up counters pulled live from Lolalytics.

**Pro** — Live pro scene data via the Lolesports API. Browse results, standings, and upcoming matches across major regions (LCS, LEC, LCK, LPL, etc.). Includes a champion stats view scraped from gol.gg.

**Leagues** — Custom amateur league tracker powered by a Google Sheet. View standings, match history with full scorecards, champion stats, and player performance ratings.

## Stack

- **Client** — React 18, TypeScript, Vite
- **Server** — Node.js, Express, TypeScript
- **Data** — Lolesports API, gol.gg (scraped), Google Sheets CSV export, DDragon (champion assets)

## Running locally

### Prerequisites
- Node.js 18+

### Server
```bash
cd server
npm install
npm run dev
```
Runs on `http://localhost:3001`

### Client
```bash
cd client
npm install
npm run dev
```
Runs on `http://localhost:5173`
