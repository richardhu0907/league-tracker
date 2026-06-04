import { Router, Request, Response } from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import logger from '../logger';

const router = Router();
const KEY = process.env.LOLESPORTS_API_KEY ?? '';
const BASE = 'https://esports-api.lolesports.com/persisted/gw';
const H = { 'x-api-key': KEY };

const cache = new Map<string, { data: unknown; ts: number }>();

async function cached<T>(key: string, fn: () => Promise<T>, ttl = 5 * 60 * 1000): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < ttl)
    return hit.data as T;
  const data = await fn();
  cache.set(key, { data, ts: Date.now() });
  return data;
}


const FEATURED = ['worlds', 'msi', 'first_stand', 'lcs', 'lec', 'lck', 'lpl', 'lcp', 'cblol-brazil'];

// GET /api/esports/leagues
router.get('/leagues', async (_req: Request, res: Response) => {
  try {
    const data = await cached('leagues', async () => {
      const r = await axios.get(`${BASE}/getLeagues?hl=en-US`, { headers: H });
      return (r.data.data.leagues as any[])
        .filter((l: any) => FEATURED.includes(l.slug))
        .sort((a: any, b: any) => FEATURED.indexOf(a.slug) - FEATURED.indexOf(b.slug))
        .map((l: any) => ({ id: l.id, slug: l.slug, name: l.name, region: l.region, image: l.image }));
    });
    res.json(data);
  } catch (err) {
    logger.error(`GET /leagues failed: ${err}`);
    res.status(500).json({ error: 'Failed to fetch leagues' });
  }
});

// GET /api/esports/results/:leagueId
// Returns recent completed matches + computed standings for the current tournament
router.get('/results/:leagueId', async (req: Request, res: Response) => {
  const leagueId = req.params.leagueId as string;
  try {
    const data = await cached(`results:${leagueId}`, async () => {
      // Find current (most recently started) tournament
      const tr = await axios.get(`${BASE}/getTournamentsForLeague?hl=en-US&leagueId=${leagueId}`, { headers: H });
      const tournaments: any[] = tr.data.data.leagues[0]?.tournaments ?? [];
      const today = new Date().toISOString().slice(0, 10);
      const current = tournaments
        .filter((t: any) => t.startDate <= today)
        .sort((a: any, b: any) => b.startDate.localeCompare(a.startDate))[0];

      if (!current) return { matches: [], standings: [] };

      // Fetch completed events for this tournament
      const er = await axios.get(
        `${BASE}/getCompletedEvents?hl=en-US&tournamentId=${current.id}`,
        { headers: H }
      );
      const events: any[] = er.data.data.schedule.events ?? [];

      // Build match list (most recent first)
      const matches = events
        .filter((e: any) => e.match?.teams?.length === 2)
        .map((e: any) => {
          const [t1, t2] = e.match.teams;
          const w1 = t1.result?.gameWins ?? 0;
          const w2 = t2.result?.gameWins ?? 0;
          return {
            id: e.match.id,
            startTime: e.startTime,
            blockName: e.blockName,
            format: e.match.strategy?.count ?? 3,
            teams: [
              { name: t1.name, code: t1.code, image: t1.image, wins: w1, won: w1 > w2 },
              { name: t2.name, code: t2.code, image: t2.image, wins: w2, won: w2 > w1 },
            ],
          };
        })
        .reverse();

      // Compute standings from series wins/losses
      const teamMap = new Map<string, { name: string; code: string; image: string; w: number; l: number }>();
      for (const m of matches) {
        for (const t of m.teams) {
          if (!teamMap.has(t.code)) teamMap.set(t.code, { name: t.name, code: t.code, image: t.image, w: 0, l: 0 });
          const rec = teamMap.get(t.code)!;
          if (t.won) rec.w++; else rec.l++;
        }
      }
      const standings = Array.from(teamMap.values())
        .sort((a, b) => b.w - a.w || a.l - b.l);

      // replace underscores with spaces in tournament slug (e.g. "lcs_2024" → "LCS 2024")
      return { matches, standings, tournament: { name: current.slug.replace(/_/g, ' ').toUpperCase() } };
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to fetch results' });
  }
});

// GET /api/esports/upcoming/:leagueId
// Returns upcoming scheduled matches
router.get('/upcoming/:leagueId', async (req: Request, res: Response) => {
  const leagueId = req.params.leagueId as string;
  try {
    const data = await cached(`upcoming:${leagueId}`, async () => {
      const r = await axios.get(`${BASE}/getSchedule?hl=en-US&leagueId=${leagueId}`, { headers: H });
      const events: any[] = r.data.data.schedule.events ?? [];
      return events
        .filter((e: any) => e.state === 'unstarted' && e.type === 'match')
        .slice(0, 10)
        .map((e: any) => ({
          id: e.match.id,
          startTime: e.startTime,
          blockName: e.blockName,
          format: e.match.strategy?.count ?? 3,
          teams: e.match.teams.map((t: any) => ({
            name: t.name, code: t.code, image: t.image,
          })),
        }));
    });
    res.json(data);
  } catch (err) {
    logger.error(`GET /upcoming failed: ${err}`);
    res.status(500).json({ error: 'Failed to fetch upcoming matches' });
  }
});

// gol.gg image filenames match DDragon IDs except for these
const GOL_TO_DDRAGON: Record<string, string> = {
  'Wukong': 'MonkeyKing',
  'Nunu & Willump': 'Nunu',
};

function toDDragonId(name: string, imgSrc: string): string {
  // extract champion filename from gol.gg image path, e.g. "/champions_icon/Azir.png" → "Azir"
  const m = imgSrc.match(/champions_icon\/(.+?)\.png/i);
  if (m) return GOL_TO_DDRAGON[m[1]] ?? m[1];
  // fallback: strip everything except letters and digits to match DDragon IDs
  return GOL_TO_DDRAGON[name] ?? name.replace(/[^a-zA-Z0-9]/g, '');
}

function currentGolParams(): { season: string; split: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1–12
  const season = `S${year - 2010}`;
  let split = 'Spring';
  if (month <= 3) split = 'Winter';
  else if (month <= 6) split = 'Spring';
  else if (month <= 9) split = 'Summer';
  else split = 'Pre-Season';
  return { season, split };
}

// GET /api/esports/champstats/:leagueId
// Scrapes gol.gg champion stats for the current season/split. Cached 30 minutes.
router.get('/champstats/:leagueId', async (_req: Request, res: Response) => {
  try {
    const { season, split } = currentGolParams();

    const data = await cached(`champstats-gol:${season}:${split}`, async () => {
      const url = `https://gol.gg/champion/list/season-${season}/split-${split}/tournament-ALL/`;
      const { data: html } = await axios.get<string>(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 15000,
      });

      const $ = cheerio.load(html);
      const champions: object[] = [];

      $('table.table_list tbody tr').each((_, row) => {
        const tds = $(row).find('td');
        if (tds.length < 7) return;
        const img = tds.eq(0).find('img');
        const name = img.attr('alt') ?? '';
        if (!name) return;
        const id = toDDragonId(name, img.attr('src') ?? '');
        champions.push({
          name, id,
          picks: parseInt(tds.eq(1).text().trim()) || 0,
          bans: parseInt(tds.eq(2).text().trim()) || 0,
          prioScore: tds.eq(3).text().trim(),
          wins: parseInt(tds.eq(4).text().trim()) || 0,
          losses: parseInt(tds.eq(5).text().trim()) || 0,
          winRate: tds.eq(6).text().trim(),
        });
      });

      return { season, split, data: champions };
    }, 30 * 60 * 1000);

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to fetch champion stats' });
  }
});

export default router;
