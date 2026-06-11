import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import logger from '../logger';

const router = Router();

const DATA_FILE = path.join(__dirname, '../../data/pro-drafts.json');

function loadData(): Record<string, any[]> {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {};
  }
}

router.get('/games', (req: Request, res: Response) => {
  const page = req.query.page as string;
  if (!page) return res.status(400).json({ error: 'page param required (e.g. LCS 2026 Spring)' });

  try {
    const data = loadData();
    res.json(data[page] ?? []);
  } catch (err: any) {
    logger.error(`GET /promatches/games failed: ${err}`);
    res.status(500).json({ error: err.message ?? 'Failed to load match data' });
  }
});

export default router;
