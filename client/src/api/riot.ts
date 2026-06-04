import axios from 'axios';
import { Match, Summoner } from '../types';

const BASE = 'http://localhost:3001/api';

let ddVersion = '14.24.1';

export async function loadDDragonVersion(): Promise<void> {
  try {
    const res = await axios.get<string[]>('https://ddragon.leagueoflegends.com/api/versions.json');
    ddVersion = res.data[0];
  } catch {
    // fall back to hardcoded version
  }
}

export function getDDragonVersion(): string {
  return ddVersion;
}

export async function searchSummoner(platform: string, gameName: string, tagLine: string): Promise<Summoner> {
  const res = await axios.get<Summoner>(
    `${BASE}/summoner/${platform}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
  );
  return res.data;
}

export async function getMatchIds(region: string, puuid: string, count = 10): Promise<string[]> {
  const res = await axios.get<string[]>(`${BASE}/matches/${region}/${puuid}?count=${count}`);
  return res.data;
}

export async function getMatch(region: string, matchId: string): Promise<Match> {
  const res = await axios.get<Match>(`${BASE}/matches/${region}/match/${matchId}`);
  return res.data;
}
