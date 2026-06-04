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
