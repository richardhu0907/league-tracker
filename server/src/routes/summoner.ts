import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

const PLATFORM_TO_REGION: Record<string, string> = {
  na1: 'americas', br1: 'americas', la1: 'americas', la2: 'americas',
  euw1: 'europe', eun1: 'europe', tr1: 'europe', ru: 'europe',
  kr: 'asia', jp1: 'asia',
  oc1: 'sea',
};

router.get('/:platform/:gameName/:tagLine', async (req: Request, res: Response) => {
  const platform = req.params.platform as string;
  const gameName = req.params.gameName as string;
  const tagLine = req.params.tagLine as string;
  const region = PLATFORM_TO_REGION[platform] ?? 'americas';
  const key = process.env.RIOT_API_KEY;

  try {
    const accountRes = await axios.get(
      `https://${region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      { headers: { 'X-Riot-Token': key } }
    );
    const { puuid } = accountRes.data;

    const summonerRes = await axios.get(
      `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
      { headers: { 'X-Riot-Token': key } }
    );

    res.json({ ...summonerRes.data, puuid, gameName, tagLine, region, platform });
  } catch (err: any) {
    const status: number = err.response?.status ?? 500;
    const message: string = err.response?.data?.status?.message ?? 'Failed to fetch summoner';
    res.status(status).json({ error: message });
  }
});

export default router;
