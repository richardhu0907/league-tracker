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
  autoChamp: ChampionData | null;
  autoAction: 'pick' | 'ban';
  onSelect: (id: string) => void;
  usedChampions: Set<string>;
  proCounters: { id: string; count: number }[];
  champMap: Map<string, string>;
}

export default function CounterPanel({ champions, version, autoChamp, autoAction, onSelect, usedChampions, proCounters, champMap }: Props) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ChampionData | null>(null);
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Maps lolalytics slug (e.g. "missfortune") → DDragon id (e.g. "MissFortune")
  const slugToId = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of champions) {
      map.set(c.name.toLowerCase().replace(/[^a-z]/g, ''), c.id);
    }
    return map;
  }, [champions]);

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

  useEffect(() => {
    if (!autoChamp) return;
    fetchMatchups(autoChamp, autoAction);
  }, [autoChamp, autoAction]);

  const fetchMatchups = (champ: ChampionData, mode: 'pick' | 'ban') => {
    setSelected(champ);
    setSearch(champ.name);
    setOpen(false);
    setLoading(true);
    setMatchups([]);
    const url = `${import.meta.env.VITE_API_URL ?? ''}/api/matchups/${champ.id}${mode === 'ban' ? '?mode=best' : ''}`;
    fetch(url)
      .then(r => r.json())
      .then(data => Array.isArray(data) ? setMatchups(data) : setMatchups([]))
      .catch(() => setMatchups([]))
      .finally(() => setLoading(false));
  };

  const selectChamp = (champ: ChampionData) => fetchMatchups(champ, 'pick');

  return (
    <div className="counter-panel">
      <div className="counter-header">
        <span className="counter-title">{selected ? (autoAction === 'ban' ? 'Best Matchups' : 'Counters') : 'Counters'}</span>
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

      <div className="counter-body">
        {autoAction === 'pick' && proCounters.length > 0 && (
          <>
            <div className="counter-section">
              <div className="counter-pro-label">Pro Picks</div>
              <div className="counter-list">
                {proCounters.map(({ id, count }, i) => {
                  const isUsed = usedChampions.has(id);
                  return (
                    <button
                      key={id}
                      className={`counter-row${isUsed ? ' used' : ''}`}
                      onClick={() => onSelect(id)}
                      disabled={isUsed}
                    >
                      <span className="counter-rank">{i + 1}</span>
                      <img
                        src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${id}.png`}
                        alt={id}
                        className="counter-icon"
                      />
                      <span className="counter-name">{champMap.get(id) ?? id}</span>
                      <span className="counter-games">{count} games</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="counter-divider" />
          </>
        )}

        <div className="counter-section">
          <div className="counter-pro-label">SoloQ Picks</div>
          {loading && <div className="counter-status">Loading...</div>}
          {!loading && matchups.length > 0 && (
            <div className="counter-list">
              {matchups.map((m, i) => {
                const ddId = slugToId.get(m.opponentSlug);
                const isUsed = ddId ? usedChampions.has(ddId) : false;
                return (
                  <button
                    key={m.opponent}
                    className={`counter-row${isUsed ? ' used' : ''}`}
                    onClick={() => ddId && onSelect(ddId)}
                    disabled={!ddId || isUsed}
                  >
                    <span className="counter-rank">{i + 1}</span>
                    <img
                      src={ddId
                        ? `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${ddId}.png`
                        : `https://cdn5.lolalytics.com/champx46/${m.opponentSlug}.webp`}
                      alt={m.opponent}
                      className="counter-icon"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span className="counter-name">{m.opponent}</span>
                    <span className="counter-wr">{m.winRate}%</span>
                    <span className="counter-games">{m.games.toLocaleString()} games</span>
                  </button>
                );
              })}
            </div>
          )}
          {!loading && selected && matchups.length === 0 && (
            <div className="counter-status">No counters found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
