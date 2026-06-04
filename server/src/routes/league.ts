import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

const SHEET_ID = '1ubW0_OVMK-G7ltSk2RDljYEiy038lq1P-TMYIhhrAQM';
const sheetUrl = (sheet: string) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;

const CACHE_MS = 15 * 60 * 1000;
const caches = new Map<string, { data: unknown; ts: number }>();

function getCache<T>(key: string): T | null {
  const hit = caches.get(key);
  if (hit && Date.now() - hit.ts < CACHE_MS) return hit.data as T;
  return null;
}
function setCache(key: string, data: unknown) {
  caches.set(key, { data, ts: Date.now() });
}

// Columns in the Match History sheet (0-indexed)
const C = {
  MATCH_ID: 0,
  TEAM: 1,
  PLAYER: 2,
  CHAMPION: 3,
  LANE: 4,
  KDA: 6,
  RESULT: 39,
  DATE: 40,
  BAN: 84,
  SIDE: 109,
  SS1: 110,
  SS2: 111,
  RUNES_MAIN: 112,
  ITEM1: 47,
  ITEM2: 48,
  ITEM3: 49,
  ITEM4: 50,
  ITEM5: 51,
  ITEM6: 52,
  ITEM7: 53,
};

function parseRow(line: string): string[] {
  const s = line.trim();
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1).split('","');
  return s.split(',');
}

function parseKDA(raw: string): { k: number; d: number; a: number } {
  const parts = raw.split('/').map(p => parseInt(p.trim()) || 0);
  return { k: parts[0] ?? 0, d: parts[1] ?? 0, a: parts[2] ?? 0 };
}

interface Player {
  name: string;
  champion: string;
  lane: string;
  kda: string;
  k: number;
  d: number;
  a: number;
  items: string[];
  ss1: string;
  ss2: string;
  runesMain: string;
}

interface TeamData {
  name: string;
  won: boolean;
  players: Player[];
  bans: string[];
}

interface Match {
  matchId: string;
  date: string;
  blue: TeamData;
  red: TeamData;
}

function parseSheet(csv: string) {
  const lines = csv.split('\n');
  // First 3 rows are headers — data starts at index 3
  const dataLines = lines.slice(3);

  // First pass: collect all rows per match.
  // Game # (col 0) is only filled on the first player row — forward-fill it.
  const matchRows = new Map<string, string[][]>();
  const matchOrder: string[] = [];
  let currentMatchId = '';

  for (const line of dataLines) {
    if (!line.trim()) continue;
    const cols = parseRow(line);

    const rawId = cols[C.MATCH_ID];
    if (rawId?.match(/^NA\d+_\d+/)) currentMatchId = rawId;
    if (!currentMatchId) continue;

    if (!matchRows.has(currentMatchId)) {
      matchRows.set(currentMatchId, []);
      matchOrder.push(currentMatchId);
    }
    matchRows.get(currentMatchId)!.push(cols);
  }

  // Second pass: build structured match data
  const matches: Match[] = [];

  for (const matchId of matchOrder) {
    const rows = matchRows.get(matchId)!;
    const blue: TeamData = { name: '', won: false, players: [], bans: [] };
    const red: TeamData  = { name: '', won: false, players: [], bans: [] };

    for (const cols of rows) {
      const side = cols[C.SIDE] === 'Blue' ? blue : red;

      if (cols[C.TEAM] && !side.name) {
        side.name = cols[C.TEAM];
        side.won = cols[C.RESULT] === 'Victory';
      }

      const kda = parseKDA(cols[C.KDA]);
      side.players.push({
        name: cols[C.PLAYER] ?? '',
        champion: cols[C.CHAMPION] ?? '',
        lane: cols[C.LANE] ?? '',
        kda: cols[C.KDA] ?? '',
        ...kda,
        items: [C.ITEM1, C.ITEM2, C.ITEM3, C.ITEM4, C.ITEM5, C.ITEM6, C.ITEM7]
          .map(i => cols[i] ?? '').filter(Boolean),
        ss1: cols[C.SS1] ?? '',
        ss2: cols[C.SS2] ?? '',
        runesMain: cols[C.RUNES_MAIN] ?? '',
      });

      const ban = cols[C.BAN];
      if (ban && side.bans.length < 5) side.bans.push(ban);
    }

    matches.push({ matchId, date: rows[0][C.DATE] ?? '', blue, red });
  }

  // Standings: win/loss per team
  const teamMap = new Map<string, { name: string; w: number; l: number }>();
  for (const m of matches) {
    for (const side of [m.blue, m.red]) {
      if (!side.name) continue;
      if (!teamMap.has(side.name)) teamMap.set(side.name, { name: side.name, w: 0, l: 0 });
      const rec = teamMap.get(side.name)!;
      if (side.won) rec.w++; else rec.l++;
    }
  }
  const standings = Array.from(teamMap.values()).sort((a, b) => b.w - a.w || a.l - b.l);

  return {
    totalGames: matches.length,
    matches: [...matches].reverse(), // most recent first
    standings,
  };
}

// GET /api/league/overview — match history + standings
router.get('/overview', async (_req: Request, res: Response) => {
  const cached = getCache<unknown>('overview');
  if (cached) { res.json(cached); return; }
  try {
    const r = await axios.get<string>(sheetUrl('Match History'), { responseType: 'text' });
    const data = parseSheet(r.data);
    setCache('overview', data);
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Failed to load league data' });
  }
});

// GET /api/league/champstats — from the pre-computed Champ Stats sheet
router.get('/champstats', async (_req: Request, res: Response) => {
  const cached = getCache<unknown>('champstats');
  if (cached) { res.json(cached); return; }
  try {
    const r = await axios.get<string>(sheetUrl('Champ Stats'), { responseType: 'text' });
    const lines = r.data.split('\n');
    // Row 0 is the header, data starts at row 1
    const data = lines
      .slice(1)
      .filter(l => l.trim())
      .map(line => {
        const cols = line.trim().replace(/^"/, '').replace(/"$/, '').split('","');
        const name = cols[2];
        if (!name) return null;
        return {
          rank:      parseInt(cols[1]) || 0,
          name,
          presence:  parseInt(cols[3]) || 0,
          presencePct: cols[4] ?? '',
          picks:     parseInt(cols[5]) || 0,
          bans:      parseInt(cols[6]) || 0,
          pickPct:   cols[7] ?? '',
          banPct:    cols[8] ?? '',
          wins:      parseInt(cols[9]) || 0,
          losses:    parseInt(cols[10]) || 0,
          winPct:    cols[11] ?? '',
          bluePicks: parseInt(cols[12]) || 0,
          redPicks:  parseInt(cols[13]) || 0,
          blueBans:  parseInt(cols[14]) || 0,
          redBans:   parseInt(cols[15]) || 0,
        };
      })
      .filter(Boolean);

    setCache('champstats', data);
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Failed to load champ stats' });
  }
});

// GET /api/league/players — per-player averages from the Player Stats sheet
router.get('/players', async (_req: Request, res: Response) => {
  const cached = getCache<unknown>('players');
  if (cached) { res.json(cached); return; }
  try {
    const r = await axios.get<string>(sheetUrl('Player Stats'), { responseType: 'text' });
    const lines = r.data.split('\n');

    const players = lines
      .slice(1) // skip header
      .map(line => parseRow(line))
      .filter(cols => cols[2]?.trim().replace(/"/g, '')) // skip blank-name rows
      .map(cols => {
        const clean = (i: number) => cols[i]?.trim().replace(/^"|"$/g, '') ?? '';
        const num   = (i: number) => parseFloat(clean(i)) || 0;
        return {
          name:   clean(2),
          team:   clean(3),
          role:   clean(4),
          score:  num(5),
          rating: num(8),
          kg:     num(9),
          dg:     num(10),
          ag:     num(11),
          kdag:   num(12),
          csg:    num(13),
        };
      });

    setCache('players', players);
    res.json(players);
  } catch {
    res.status(500).json({ error: 'Failed to load player stats' });
  }
});

export default router;
