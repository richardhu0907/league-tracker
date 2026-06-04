import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// Cache to avoid hammering external APIs on every request
let cache: { data: object; ts: number } | null = null;
const CACHE_MS = 10 * 60 * 1000; // 10 minutes

router.get('/tier-list', async (_req: Request, res: Response) => {
  if (cache && Date.now() - cache.ts < CACHE_MS) {
    res.json(cache.data);
    return;
  }

  try {
    const [versionsRes, merakiRes] = await Promise.all([
      axios.get<string[]>('https://ddragon.leagueoflegends.com/api/versions.json'),
      axios.get<{ patch: string; data: Record<string, Record<string, { playRate: number; winRate: number; banRate: number }>> }>(
        'https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/championrates.json'
      ),
    ]);

    const version = versionsRes.data[0];

    const champRes = await axios.get<{ data: Record<string, { id: string; key: string; name: string }> }>(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`
    );

    // numeric key → {id, name}
    const keyMap = new Map<string, { id: string; name: string }>();
    for (const c of Object.values(champRes.data.data)) {
      keyMap.set(c.key, { id: c.id, name: c.name });
    }

    const rates = merakiRes.data.data;
    const result: object[] = [];

    for (const [numKey, roleData] of Object.entries(rates)) {
      const champ = keyMap.get(numKey);
      if (!champ) continue;

      for (const [role, stats] of Object.entries(roleData)) {
        if (stats.playRate < 0.001) continue; // skip near-zero entries
        result.push({
          id: champ.id,
          name: champ.name,
          role,
          winRate: stats.winRate,
          pickRate: stats.playRate,
          banRate: stats.banRate,
        });
      }
    }

    result.sort((a: any, b: any) => b.winRate - a.winRate);

    const payload = { patch: merakiRes.data.patch, data: result };
    cache = { data: payload, ts: Date.now() };
    res.json(payload);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch champion stats' });
  }
});

export default router;
