import { Router, Request, Response } from 'express';
import axios from 'axios';
import { cached } from '../cache';

const router = Router();
const TTL = 30 * 60 * 1000; // lolalytics scrape — refresh every 30 min

const DDRAGON_OVERRIDES: Record<string, string> = {
  monkeyking: 'wukong',
};

function toSlug(ddId: string): string {
  const lower = ddId.toLowerCase();
  // strip anything that isn't a lowercase letter to match lolalytics URL slugs (e.g. "Kai'Sa" → "kaisa")
  return DDRAGON_OVERRIDES[lower] ?? lower.replace(/[^a-z]/g, '');
}

// GET /api/matchups/:champion
// Scrapes lolalytics.com for worst counters (≥1000 games). Cached 30 min per champion.
router.get('/:champion', async (req: Request, res: Response) => {
  const slug = toSlug(req.params.champion as string);

  try {
    const data = await cached(slug, async () => {
      const { data: html } = await axios.get<string>(
        `https://lolalytics.com/lol/${slug}/counters/`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }, timeout: 10000 }
      );

      // matches each counter card in the HTML: captures (1) win rate, (2) opponent name, (3) game count
      // looks for a win-rate percentage in a text-center div, then the opponent's img alt, then "N Games"
      const re = /class="text-center[^"]*"[^>]*><!--t=\w+-->([\d.]+)<!---->%[\s\S]*?alt="([^"]+)" data-id=""[\s\S]*?([\d,]+) Games/g;
      const matchups: { opponent: string; opponentSlug: string; winRate: number; games: number }[] = [];
      let m: RegExpExecArray | null;

      while ((m = re.exec(html)) !== null) {
        const games = parseInt(m[3].replace(/,/g, '')); // remove thousands commas before parsing
        if (games < 1000) continue;
        const opponent = m[2];
        matchups.push({
          opponent,
          opponentSlug: opponent.toLowerCase().replace(/[^a-z]/g, ''), // strip non-letters for lolalytics image URL
          winRate: parseFloat(m[1]),
          games,
        });
      }

      matchups.sort((a, b) => a.winRate - b.winRate);
      return matchups.slice(0, 5);
    }, TTL);

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to fetch matchup data' });
  }
});

export default router;
