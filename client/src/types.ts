export interface Summoner {
  puuid: string;
  gameName: string;
  tagLine: string;
  region: string;
  platform: string;
  name: string;
  summonerLevel: number;
  profileIconId: number;
}

export interface Participant {
  puuid: string;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  goldEarned: number;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  teamPosition: string;
}

export interface ChampionData {
  id: string;
  name: string;
  tags: string[];
}

export type DraftTeam = 'blue' | 'red';
export type DraftActionType = 'ban' | 'pick';

export interface DraftAction {
  team: DraftTeam;
  type: DraftActionType;
  slot: number;
}

export interface DraftState {
  blueBans: (string | null)[];
  redBans: (string | null)[];
  bluePicks: (string | null)[];
  redPicks: (string | null)[];
}

export interface Match {
  metadata: {
    matchId: string;
    participants: string[];
  };
  info: {
    gameId: number;
    gameDuration: number;
    gameMode: string;
    participants: Participant[];
    queueId: number;
  };
}
