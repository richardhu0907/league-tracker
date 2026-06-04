import { useState, useEffect } from 'react';
import { getMatchIds, getMatch } from '../api/riot';
import { Match } from '../types';
import MatchCard from './MatchCard';

interface Props {
  puuid: string;
  region: string;
}

export default function MatchHistory({ puuid, region }: Props) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMatches([]);
    setError('');

    (async () => {
      try {
        const ids = await getMatchIds(region, puuid, 10);
        const details = await Promise.all(ids.map(id => getMatch(region, id)));
        if (!cancelled) setMatches(details);
      } catch (err: any) {
        if (!cancelled) {
          const status = err.response?.status;
          if (status === 429) setError('Rate limited by Riot API — wait ~2 minutes and try again.');
          else if (status === 403) setError('API key expired — regenerate it at developer.riotgames.com.');
          else setError('Failed to load match history.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [puuid, region]);

  if (loading) return <div className="loading">Loading matches...</div>;
  if (error) return <div className="error-msg">{error}</div>;
  if (matches.length === 0) return <div className="loading">No recent matches found</div>;

  return (
    <div className="match-list">
      {matches.map(match => (
        <MatchCard key={match.metadata.matchId} match={match} puuid={puuid} />
      ))}
    </div>
  );
}
