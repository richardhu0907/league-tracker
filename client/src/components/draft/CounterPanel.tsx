import { useState, useMemo, useRef, useEffect } from 'react';
import { ChampionData } from '../../types';

interface Matchup {
  opponent: string;
  opponentSlug: string;
  winRate: number;
  games: number;
}

interface Props {
  champions: ChampionData[];
  version: string;
}

export default function CounterPanel({ champions, version }: Props) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ChampionData | null>(null);
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return [];
    return champions.filter(c =>
      c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [champions, search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectChamp = (champ: ChampionData) => {
    setSelected(champ);
    setSearch(champ.name);
    setOpen(false);
    setLoading(true);
    setMatchups([]);
    fetch(`http://localhost:3001/api/matchups/${champ.id}`)
      .then(r => r.json())
      .then(data => Array.isArray(data) ? setMatchups(data) : setMatchups([]))
      .catch(() => setMatchups([]))
      .finally(() => setLoading(false));
  };

  return (
    <div className="counter-panel">
      <div className="counter-header">
        <span className="counter-title">Counters</span>
        <div className="counter-search-wrap" ref={wrapRef}>
          <input
            type="text"
            placeholder="Search champion..."
            value={search}
            className="counter-search"
            onChange={e => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            autoComplete="off"
          />
          {open && suggestions.length > 0 && (
            <div className="counter-suggestions">
              {suggestions.map(c => (
                <button key={c.id} className="counter-suggestion" onMouseDown={() => selectChamp(c)}>
                  <img
                    src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${c.id}.png`}
                    alt={c.name}
                  />
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading && <div className="counter-status">Loading...</div>}

      {!loading && matchups.length > 0 && (
        <div className="counter-list">
          {matchups.map((m, i) => (
            <div key={m.opponent} className="counter-row">
              <span className="counter-rank">{i + 1}</span>
              <img
                src={`https://cdn5.lolalytics.com/champx46/${m.opponentSlug}.webp`}
                alt={m.opponent}
                className="counter-icon"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span className="counter-name">{m.opponent}</span>
              <span className="counter-wr">{m.winRate}%</span>
              <span className="counter-games">{m.games.toLocaleString()} games</span>
            </div>
          ))}
        </div>
      )}

      {!loading && selected && matchups.length === 0 && (
        <div className="counter-status">No counters found with 1,000+ games.</div>
      )}
    </div>
  );
}
