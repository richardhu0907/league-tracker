import axios from 'axios';

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
