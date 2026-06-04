import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

router.get('/:region/:puuid', async (req: Request, res: Response) => {
  const { region, puuid } = req.params;
  const count = parseInt(req.query.count as string) || 10;
  const key = process.env.RIOT_API_KEY;

  try {
    const result = await axios.get(
      `https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${count}`,
      { headers: { 'X-Riot-Token': key } }
    );
    res.json(result.data);
  } catch (err: any) {
    const status: number = err.response?.status ?? 500;
    res.status(status).json({ error: err.response?.data?.status?.message ?? 'Failed to fetch matches' });
  }
});

router.get('/:region/match/:matchId', async (req: Request, res: Response) => {
  const { region, matchId } = req.params;
  const key = process.env.RIOT_API_KEY;

  try {
    const result = await axios.get(
      `https://${region}.api.riotgames.com/lol/match/v5/matches/${matchId}`,
      { headers: { 'X-Riot-Token': key } }
    );
    res.json(result.data);
  } catch (err: any) {
    const status: number = err.response?.status ?? 500;
    res.status(status).json({ error: err.response?.data?.status?.message ?? 'Failed to fetch match' });
  }
});

export default router;
