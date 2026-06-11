import { Router, Request, Response } from 'express';
import { execFile } from 'child_process';
import * as cheerio from 'cheerio';
import logger from '../logger';
import { cached } from '../cache';

const router = Router();

const TTL = 24 * 60 * 60 * 1000;

function fetchWithCurl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('curl', [
      '-s', '-L', url,
      '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '-H', 'Accept: text/html,application/xhtml+xml',
      '-H', 'Accept-Language: en-US,en;q=0.9',
      '-H', 'Referer: https://lol.fandom.com/',
    ], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

const C = {
  PHASE:   0,
  TEAM1:   1,
  TEAM2:   2,
  SCORE:   3,
  WINNER:  4,
  PATCH:   5,
  T1B1: 6,  T2B1: 7,
  T1B2: 8,  T2B2: 9,
  T1B3: 10, T2B3: 11,
  T1P1: 12,
  T2P12: 13,
  T1P23: 14,
  T2P3: 15,
  T2B4: 16, T1B4: 17,
  T2B5: 18, T1B5: 19,
  T2P4: 20,
  T1P45: 21,
  T2P5: 22,
  T1R1: 23, T1R2: 24, T1R3: 25, T1R4: 26, T1R5: 27,
  T2R1: 28, T2R2: 29, T2R3: 30, T2R4: 31, T2R5: 32,
};

function pbhUrl(page: string) {
  const params = new URLSearchParams({ 'PBH[page]': page, 'PBH[textonly]': 'Yes', '_run': '' });
  return `https://lol.fandom.com/wiki/Special:RunQuery/PickBanHistory?${params}`;
}

function splitTwo(cell: string): [string, string] {
  const parts = cell.split(',').map(s => s.trim());
  return [parts[0] ?? '', parts[1] ?? ''];
}

function parseTable(html: string) {
  const $ = cheerio.load(html);
  const results: any[] = [];

  $('table tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 23) return;

    const get = (i: number) => $(cells[i]).text().trim().replace(/\s+/g, ' ');

    const [t2p1, t2p2] = splitTwo(get(C.T2P12));
    const [t1p2, t1p3] = splitTwo(get(C.T1P23));
    const [t1p4, t1p5] = splitTwo(get(C.T1P45));

    results.push({
      phase:   get(C.PHASE),
      team1:   get(C.TEAM1),
      team2:   get(C.TEAM2),
      score:   get(C.SCORE),
      winner:  get(C.WINNER),
      patch:   get(C.PATCH),
      draft: [
        { slot: 1,  action: 'ban',  team: 1, champion: get(C.T1B1) },
        { slot: 2,  action: 'ban',  team: 2, champion: get(C.T2B1) },
        { slot: 3,  action: 'ban',  team: 1, champion: get(C.T1B2) },
        { slot: 4,  action: 'ban',  team: 2, champion: get(C.T2B2) },
        { slot: 5,  action: 'ban',  team: 1, champion: get(C.T1B3) },
        { slot: 6,  action: 'ban',  team: 2, champion: get(C.T2B3) },
        { slot: 7,  action: 'pick', team: 1, champion: get(C.T1P1),  role: get(C.T1R1) },
        { slot: 8,  action: 'pick', team: 2, champion: t2p1,          role: get(C.T2R1) },
        { slot: 9,  action: 'pick', team: 2, champion: t2p2,          role: get(C.T2R2) },
        { slot: 10, action: 'pick', team: 1, champion: t1p2,          role: get(C.T1R2) },
        { slot: 11, action: 'pick', team: 1, champion: t1p3,          role: get(C.T1R3) },
        { slot: 12, action: 'pick', team: 2, champion: get(C.T2P3),   role: get(C.T2R3) },
        { slot: 13, action: 'ban',  team: 2, champion: get(C.T2B4) },
        { slot: 14, action: 'ban',  team: 1, champion: get(C.T1B4) },
        { slot: 15, action: 'ban',  team: 2, champion: get(C.T2B5) },
        { slot: 16, action: 'ban',  team: 1, champion: get(C.T1B5) },
        { slot: 17, action: 'pick', team: 2, champion: get(C.T2P4),   role: get(C.T2R4) },
        { slot: 18, action: 'pick', team: 1, champion: t1p4,           role: get(C.T1R4) },
        { slot: 19, action: 'pick', team: 1, champion: t1p5,           role: get(C.T1R5) },
        { slot: 20, action: 'pick', team: 2, champion: get(C.T2P5),   role: get(C.T2R5) },
      ],
    });
  });

  return results;
}

router.get('/games', async (req: Request, res: Response) => {
  const page = req.query.page as string;
  if (!page) return res.status(400).json({ error: 'page param required (e.g. LCS 2026 Spring)' });

  try {
    const data = await cached(`promatches:${page}`, async () => {
      const html = await fetchWithCurl(pbhUrl(page));
      return parseTable(html);
    }, TTL);

    res.json(data);
  } catch (err: any) {
    logger.error(`GET /promatches/games failed: ${err}`);
    res.status(500).json({ error: err.message ?? 'Failed to fetch match data' });
  }
});

export default router;
