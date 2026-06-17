import { useState, useMemo, useRef, useEffect } from 'react';
import { ChampionData } from '../../types';
import { champId } from '../../utils/champId';

interface Matchup {
  opponent: string;
  opponentSlug: string;
  winRate: number;
  games: number;
}

interface RawGame {
  patch: string;
  draft: { slot: number; champion: string; team?: number; role?: string }[];
}

interface Props {
  champions: ChampionData[];
  version: string;
  autoChamp: ChampionData | null;
  autoAction: 'pick' | 'ban';
  onSelect: (id: string) => void;
  usedChampions: Set<string>;
  filteredGames: RawGame[];
  champMap: Map<string, string>;
  minimized?: boolean;
}

export default function CounterPanel({ champions, version, autoChamp, autoAction, onSelect, usedChampions, filteredGames, champMap, minimized }: Props) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ChampionData | null>(null);
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [userOverride, setUserOverride] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Derived: collapsed unless user explicitly searched while minimized
  const collapsed = (minimized ?? false) && !userOverride;

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

  // Compute pro counters from filteredGames based on the currently selected champ
  const proCounters = useMemo(() => {
    if (!selected) return [];
    const targetId = selected.id;
    const countMap = new Map<string, number>();
    for (const game of filteredGames) {
      const picks = game.draft.filter(d => d.slot >= 7);
      const champPick = picks.find(d => champId(d.champion) === targetId && d.role && d.team != null);
      if (!champPick) continue;
      const opposing = picks.find(d =>
        d.team !== champPick.team &&
        d.role === champPick.role &&
        d.slot > champPick.slot
      );
      if (opposing?.champion) {
        const id = champId(opposing.champion);
        if (id) countMap.set(id, (countMap.get(id) ?? 0) + 1);
      }
    }
    return [...countMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ id, count }));
  }, [selected, filteredGames]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset user override whenever the minimized state changes (e.g. new phase starts)
  useEffect(() => {
    setUserOverride(false);
  }, [minimized]);

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

  const selectChamp = (champ: ChampionData) => {
    fetchMatchups(champ, 'pick');
    setUserOverride(true);
  };

  return (
    <div className={`counter-panel${collapsed ? ' counter-minimized' : ''}`}>
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

      {!collapsed && <div className="counter-body">
        {autoAction === 'pick' && (
          <>
            <div className="counter-section">
              <div className="counter-pro-label">Pro Picks</div>
              {selected && proCounters.length === 0 && (
                <div className="counter-status">No picks in pro data.</div>
              )}
              {proCounters.length > 0 && (
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
              )}
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
      </div>}
    </div>
  );
}
