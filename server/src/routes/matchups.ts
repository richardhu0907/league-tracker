import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_MS = 30 * 60 * 1000;

const DDRAGON_OVERRIDES: Record<string, string> = {
  monkeyking: 'wukong',
};

function toSlug(ddId: string): string {
  const lower = ddId.toLowerCase();
  return DDRAGON_OVERRIDES[lower] ?? lower.replace(/[^a-z]/g, '');
}

// GET /api/matchups/:champion
// Scrapes lolalytics.com for worst counters (≥1000 games). Cached 30 min per champion.
router.get('/:champion', async (req: Request, res: Response) => {
  const slug = toSlug(req.params.champion as string);

  const hit = cache.get(slug);
  if (hit && Date.now() - hit.ts < CACHE_MS) { res.json(hit.data); return; }

  try {
    const { data: html } = await axios.get<string>(
      `https://lolalytics.com/lol/${slug}/counters/`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }, timeout: 10000 }
    );

    // Each matchup card: text-center win-rate div → opponent alt → N Games
    const re = /class="text-center[^"]*"[^>]*><!--t=\w+-->([\d.]+)<!---->%[\s\S]*?alt="([^"]+)" data-id=""[\s\S]*?([\d,]+) Games/g;
    const matchups: { opponent: string; opponentSlug: string; winRate: number; games: number }[] = [];
    let m: RegExpExecArray | null;

    while ((m = re.exec(html)) !== null) {
      const games = parseInt(m[3].replace(/,/g, ''));
      if (games < 1000) continue;
      const opponent = m[2];
      matchups.push({
        opponent,
        opponentSlug: opponent.toLowerCase().replace(/[^a-z]/g, ''),
        winRate: parseFloat(m[1]),
        games,
      });
    }

    matchups.sort((a, b) => a.winRate - b.winRate);
    const result = matchups.slice(0, 5);

    cache.set(slug, { data: result, ts: Date.now() });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to fetch matchup data' });
  }
});

export default router;
