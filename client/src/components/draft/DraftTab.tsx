import { useState, useEffect, useRef, useMemo } from 'react';
import { ChampionData, DraftAction, DraftState } from '../../types';
import ChampionGrid from './ChampionGrid';
import CounterPanel from './CounterPanel';
import { champId } from '../../utils/champId';

const DRAFT_ORDER: DraftAction[] = [
  // Ban Phase 1 — Blue first, alternating
  { team: 'blue', type: 'ban', slot: 0 },
  { team: 'red',  type: 'ban', slot: 0 },
  { team: 'blue', type: 'ban', slot: 1 },
  { team: 'red',  type: 'ban', slot: 1 },
  { team: 'blue', type: 'ban', slot: 2 },
  { team: 'red',  type: 'ban', slot: 2 },
  // Pick Phase 1
  { team: 'blue', type: 'pick', slot: 0 },
  { team: 'red',  type: 'pick', slot: 0 },
  { team: 'red',  type: 'pick', slot: 1 },
  { team: 'blue', type: 'pick', slot: 1 },
  { team: 'blue', type: 'pick', slot: 2 },
  { team: 'red',  type: 'pick', slot: 2 },
  // Ban Phase 2 — Red first
  { team: 'red',  type: 'ban', slot: 3 },
  { team: 'blue', type: 'ban', slot: 3 },
  { team: 'red',  type: 'ban', slot: 4 },
  { team: 'blue', type: 'ban', slot: 4 },
  // Pick Phase 2
  { team: 'red',  type: 'pick', slot: 3 },
  { team: 'blue', type: 'pick', slot: 3 },
  { team: 'blue', type: 'pick', slot: 4 },
  { team: 'red',  type: 'pick', slot: 4 },
];

function emptyDraft(): DraftState {
  return {
    blueBans:  [null, null, null, null, null],
    redBans:   [null, null, null, null, null],
    bluePicks: [null, null, null, null, null],
    redPicks:  [null, null, null, null, null],
  };
}

const NUM_GAMES = 5;

interface BanRowProps {
  bans: (string | null)[];
  activeSlot: number;
  editingSlot?: number;
  version: string;
  onSlotClick?: (slot: number) => void;
}

function BanRow({ bans, activeSlot, editingSlot, version, onSlotClick }: BanRowProps) {
  return (
    <div className="ban-row">
      {bans.map((id, i) => (
        <div
          key={i}
          className={`ban-slot ${id ? 'filled' : ''} ${i === activeSlot ? 'active' : ''} ${i === editingSlot ? 'editing' : ''}`}
          onClick={() => id && onSlotClick?.(i)}
        >
          {id && (
            <img
              src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${id}.png`}
              alt={id}
            />
          )}
        </div>
      ))}
    </div>
  );
}

interface PickColProps {
  picks: (string | null)[];
  activeSlot: number;
  editingSlot?: number;
  team: 'blue' | 'red';
  version: string;
  champMap: Map<string, string>;
  onSlotClick?: (slot: number) => void;
}

function PickCol({ picks, activeSlot, editingSlot, team, version, champMap, onSlotClick }: PickColProps) {
  return (
    <div className="pick-col">
      {picks.map((id, i) => {
        const isActive = i === activeSlot;
        const isEditing = i === editingSlot;
        return (
          <div
            key={i}
            className={`pick-slot ${id ? 'filled' : ''} ${isActive ? `active ${team}-active` : ''} ${isEditing ? 'editing' : ''}`}
            onClick={() => id && onSlotClick?.(i)}
          >
            {id ? (
              <>
                <img
                  src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${id}.png`}
                  alt={id}
                  className="pick-splash"
                />
                <span className="pick-splash-name">{champMap.get(id) ?? id}</span>
              </>
            ) : (
              <span className="pick-empty">{isActive ? (team === 'blue' ? '← Pick' : 'Pick →') : ''}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DraftTab() {
  const [champions, setChampions] = useState<ChampionData[]>([]);
  const [champMap, setChampMap] = useState<Map<string, string>>(new Map());
  const [version, setVersion] = useState('14.24.1');
  const [loading, setLoading] = useState(true);

  const [rawGames,       setRawGames]       = useState<{ patch: string; draft: { slot: number; champion: string; team?: number; role?: string }[] }[]>([]);
  const [selectedPatches, setSelectedPatches] = useState<string[]>(['all']);
  const patchFilterRef = useRef<HTMLDivElement>(null);
  const [patchOpen, setPatchOpen] = useState(false);

  const [currentGame, setCurrentGame] = useState(0);
  const [gameDrafts, setGameDrafts] = useState<DraftState[]>(() => Array.from({ length: NUM_GAMES }, emptyDraft));
  const [gameSteps, setGameSteps] = useState<number[]>(() => Array(NUM_GAMES).fill(0));

  const [resetKey, setResetKey] = useState(0);
  const [hidePicked, setHidePicked] = useState(false);
  const [autoChamp, setAutoChamp] = useState<ChampionData | null>(null);
  const [autoAction, setAutoAction] = useState<'pick' | 'ban'>('pick');
  const [editingSlot, setEditingSlot] = useState<{ team: 'blue' | 'red'; type: 'ban' | 'pick'; slot: number } | null>(null);

  useEffect(() => {
    fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then(r => r.json())
      .then((versions: string[]) => versions[0])
      .catch(() => '14.24.1')
      .then(v => {
        setVersion(v);
        return fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US/champion.json`);
      })
      .then(r => r.json())
      .then((data: { data: Record<string, { id: string; name: string; tags: string[] }> }) => {
        const list: ChampionData[] = Object.values(data.data).map(c => ({
          id: c.id,
          name: c.name,
          tags: c.tags,
        }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        setChampions(list);
        setChampMap(new Map(list.map(c => [c.id, c.name])));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const BASE_PM = `${import.meta.env.VITE_API_URL ?? ''}/api/promatches`;
    const PAGES = [
      'LCS 2026 Spring', 'LCS 2026 Spring Playoffs',
      'LEC 2026 Spring', 'LEC 2026 Spring Playoffs',
      'LPL 2026 Split 2', 'LPL 2026 Split 2 Playoffs',
      'LCK 2026 Rounds 1-2', 'LCK 2026 Road to MSI',
    ];
    Promise.all(PAGES.map(page =>
      fetch(`${BASE_PM}/games?page=${encodeURIComponent(page)}`).then(r => r.json())
    ))
      .then((results: { patch: string; draft: { slot: number; champion: string; team?: number; role?: string }[] }[][]) => {
        setRawGames(results.flat());
      })
      .catch(() => {});
  }, []);

  // Close patch dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (patchFilterRef.current && !patchFilterRef.current.contains(e.target as Node))
        setPatchOpen(false);
    }
    if (patchOpen) document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [patchOpen]);

  const availablePatches = useMemo(
    () => Array.from(new Set(rawGames.map(g => g.patch).filter(Boolean))).sort().reverse(),
    [rawGames]
  );

  const filteredGames = useMemo(
    () => selectedPatches.includes('all') ? rawGames : rawGames.filter(g => selectedPatches.includes(g.patch)),
    [rawGames, selectedPatches]
  );

  const b1Picks = useMemo(() => {
    const counts = new Map<string, number>();
    for (const game of filteredGames) {
      const b1 = game.draft.find(d => d.slot === 7);
      if (b1?.champion) { const id = champId(b1.champion); if (id) counts.set(id, (counts.get(id) ?? 0) + 1); }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([id, count]) => ({ id, count }));
  }, [filteredGames]);

  const r12Combos = useMemo(() => {
    const r12 = new Map<string, { a: string; b: string; count: number }>();
    for (const game of filteredGames) {
      const ia = champId(game.draft.find(d => d.slot === 8)?.champion ?? '');
      const ib = champId(game.draft.find(d => d.slot === 9)?.champion ?? '');
      if (ia && ib) {
        const key = [...[ia, ib]].sort().join('|||');
        if (!r12.has(key)) r12.set(key, { a: ia, b: ib, count: 0 });
        r12.get(key)!.count++;
      }
    }
    return [...r12.values()].sort((a, b) => b.count - a.count).slice(0, 15);
  }, [filteredGames]);

  const proCounters = useMemo(() => {
    if (!autoChamp) return [];
    const targetId = autoChamp.id;
    const countMap = new Map<string, number>();
    for (const game of filteredGames) {
      const picks = game.draft.filter(d => d.slot >= 7);
      const champPick = picks.find(d => champId(d.champion) === targetId && d.role && d.team != null);
      if (!champPick) continue;
      // Only count picks made AFTER this champion (true counter picks, not blind picks)
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
  }, [autoChamp, filteredGames]);

  const b23Combos = useMemo(() => {
    const b23 = new Map<string, { a: string; b: string; count: number }>();
    for (const game of filteredGames) {
      const ia = champId(game.draft.find(d => d.slot === 10)?.champion ?? '');
      const ib = champId(game.draft.find(d => d.slot === 11)?.champion ?? '');
      if (ia && ib) {
        const key = [...[ia, ib]].sort().join('|||');
        if (!b23.has(key)) b23.set(key, { a: ia, b: ib, count: 0 });
        b23.get(key)!.count++;
      }
    }
    return [...b23.values()].sort((a, b) => b.count - a.count).slice(0, 15);
  }, [filteredGames]);

  const draft = gameDrafts[currentGame];
  const step  = gameSteps[currentGame];

  const updateDraft = (updater: (prev: DraftState) => DraftState) => {
    setGameDrafts(prev => {
      const next = [...prev];
      next[currentGame] = updater(prev[currentGame]);
      return next;
    });
  };

  const updateStep = (updater: (prev: number) => number) => {
    setGameSteps(prev => {
      const next = [...prev];
      next[currentGame] = updater(prev[currentGame]);
      return next;
    });
  };

  // Picks from all previous games — cannot be picked again (fearless)
  const eliminatedChamps = new Set<string>(
    gameDrafts.slice(0, currentGame).flatMap(d => [
      ...d.bluePicks.filter((c): c is string => c !== null),
      ...d.redPicks.filter((c): c is string => c !== null),
    ])
  );

  const isDone = step >= DRAFT_ORDER.length;
  const current = isDone ? null : DRAFT_ORDER[step];
  const editingChamp = editingSlot
    ? (editingSlot.type === 'ban'
        ? (editingSlot.team === 'blue' ? draft.blueBans : draft.redBans)[editingSlot.slot]
        : (editingSlot.team === 'blue' ? draft.bluePicks : draft.redPicks)[editingSlot.slot])
    : null;

  const allUsedChampions = new Set<string>([
    ...draft.blueBans.filter((c): c is string => c !== null),
    ...draft.redBans.filter((c): c is string => c !== null),
    ...draft.bluePicks.filter((c): c is string => c !== null),
    ...draft.redPicks.filter((c): c is string => c !== null),
  ]);
  // usedChampions removes the editing champ so the grid shows it as available for swap
  const usedChampions = new Set(allUsedChampions);
  if (editingChamp) usedChampions.delete(editingChamp);

  const handleSlotClick = (team: 'blue' | 'red', type: 'ban' | 'pick', slot: number) => {
    if (editingSlot?.team === team && editingSlot.type === type && editingSlot.slot === slot) {
      setEditingSlot(null);
    } else {
      setEditingSlot({ team, type, slot });
    }
  };

  const handleSelect = (id: string) => {
    if (editingSlot) {
      if (editingSlot.type === 'pick' && eliminatedChamps.has(id)) return;
      updateDraft(prev => {
        const next = { ...prev };
        if (editingSlot.type === 'ban') {
          const bans = editingSlot.team === 'blue' ? [...prev.blueBans] : [...prev.redBans];
          bans[editingSlot.slot] = id;
          if (editingSlot.team === 'blue') next.blueBans = bans;
          else next.redBans = bans;
        } else {
          const picks = editingSlot.team === 'blue' ? [...prev.bluePicks] : [...prev.redPicks];
          picks[editingSlot.slot] = id;
          if (editingSlot.team === 'blue') next.bluePicks = picks;
          else next.redPicks = picks;
        }
        return next;
      });
      setEditingSlot(null);
      setAutoChamp(champions.find(c => c.id === id) ?? null);
      setAutoAction(editingSlot.type);
      return;
    }

    if (isDone || usedChampions.has(id) || eliminatedChamps.has(id) || !current) return;

    updateDraft(prev => {
      const next = { ...prev };
      if (current.type === 'ban') {
        const bans = current.team === 'blue' ? [...prev.blueBans] : [...prev.redBans];
        bans[current.slot] = id;
        if (current.team === 'blue') next.blueBans = bans;
        else next.redBans = bans;
      } else {
        const picks = current.team === 'blue' ? [...prev.bluePicks] : [...prev.redPicks];
        picks[current.slot] = id;
        if (current.team === 'blue') next.bluePicks = picks;
        else next.redPicks = picks;
      }
      return next;
    });
    updateStep(s => s + 1);
    setAutoChamp(champions.find(c => c.id === id) ?? null);
    setAutoAction(current.type);
  };

  const handleDuoPick = (idA: string, idB: string) => {
    if (isDone || !current) return;
    if (current.team !== 'red' || current.type !== 'pick' || current.slot !== 0) return;
    const nextStep = DRAFT_ORDER[step + 1];
    if (!nextStep || nextStep.team !== 'red' || nextStep.type !== 'pick' || nextStep.slot !== 1) return;
    if (usedChampions.has(idA) || usedChampions.has(idB) || idA === idB) return;
    if (eliminatedChamps.has(idA) || eliminatedChamps.has(idB)) return;
    updateDraft(prev => ({
      ...prev,
      redPicks: [idA, idB, prev.redPicks[2], prev.redPicks[3], prev.redPicks[4]],
    }));
    updateStep(s => s + 2);
    setAutoChamp(null);
  };

  const handleB23Pick = (idA: string, idB: string) => {
    if (isDone || !current) return;
    if (current.team !== 'blue' || current.type !== 'pick' || current.slot !== 1) return;
    const nextStep = DRAFT_ORDER[step + 1];
    if (!nextStep || nextStep.team !== 'blue' || nextStep.type !== 'pick' || nextStep.slot !== 2) return;
    if (usedChampions.has(idA) || usedChampions.has(idB) || idA === idB) return;
    if (eliminatedChamps.has(idA) || eliminatedChamps.has(idB)) return;
    updateDraft(prev => ({
      ...prev,
      bluePicks: [prev.bluePicks[0], idA, idB, prev.bluePicks[3], prev.bluePicks[4]],
    }));
    updateStep(s => s + 2);
    setAutoChamp(null);
  };

  const handleUndo = () => {
    if (step === 0) return;
    const prev = DRAFT_ORDER[step - 1];
    updateDraft(d => {
      const next = { ...d };
      if (prev.type === 'ban') {
        const bans = prev.team === 'blue' ? [...d.blueBans] : [...d.redBans];
        bans[prev.slot] = null;
        if (prev.team === 'blue') next.blueBans = bans;
        else next.redBans = bans;
      } else {
        const picks = prev.team === 'blue' ? [...d.bluePicks] : [...d.redPicks];
        picks[prev.slot] = null;
        if (prev.team === 'blue') next.bluePicks = picks;
        else next.redPicks = picks;
      }
      return next;
    });
    updateStep(s => s - 1);
    setAutoChamp(null);
  };

  const handleReset = () => {
    setGameDrafts(Array.from({ length: NUM_GAMES }, emptyDraft));
    setGameSteps(Array(NUM_GAMES).fill(0));
    setCurrentGame(0);
    setEditingSlot(null);
    setAutoChamp(null);
    setResetKey(k => k + 1);
  };

  const switchGame = (i: number) => {
    setCurrentGame(i);
    setEditingSlot(null);
    setAutoChamp(null);
    setHidePicked(false);
    setResetKey(k => k + 1);
  };

  const v = version;
  const activeBlueBan  = current?.team === 'blue' && current.type === 'ban'  ? current.slot : -1;
  const activeRedBan   = current?.team === 'red'  && current.type === 'ban'  ? current.slot : -1;
  const activeBluePick = current?.team === 'blue' && current.type === 'pick' ? current.slot : -1;
  const activeRedPick  = current?.team === 'red'  && current.type === 'pick' ? current.slot : -1;

  const b1Suggestions = activeBluePick === 0
    ? b1Picks.filter(({ id }) => !allUsedChampions.has(id) && !eliminatedChamps.has(id)).slice(0, 5)
    : [];

  const r12Suggestions = activeRedPick === 0
    ? r12Combos
        .filter(({ a, b }) =>
          !allUsedChampions.has(a) && !allUsedChampions.has(b) &&
          !eliminatedChamps.has(a) && !eliminatedChamps.has(b)
        )
        .slice(0, 5)
    : [];

  const b23Suggestions = activeBluePick === 1
    ? b23Combos
        .filter(({ a, b }) =>
          !allUsedChampions.has(a) && !allUsedChampions.has(b) &&
          !eliminatedChamps.has(a) && !eliminatedChamps.has(b)
        )
        .slice(0, 5)
    : [];

  if (loading) return <div className="loading">Loading champions...</div>;

  return (
    <div className="draft-container">
      <div className="draft-header">
        <div className="game-tabs">
          {Array.from({ length: NUM_GAMES }, (_, i) => {
            const hasContent = gameSteps[i] > 0;
            return (
              <button
                key={i}
                className={`game-tab ${currentGame === i ? 'active' : ''} ${hasContent ? 'has-content' : ''}`}
                onClick={() => switchGame(i)}
              >
                {hasContent && <span className="game-tab-dot" />}
                G{i + 1}
              </button>
            );
          })}
        </div>
        <div className={`draft-turn ${current?.team ?? 'done'}`}>
          {isDone
            ? '✓ Draft Complete'
            : `${current!.team === 'blue' ? 'Blue' : 'Red'} Side — ${current!.type === 'ban' ? 'Ban' : 'Pick'}`}
        </div>
        <div className="draft-controls">
          {availablePatches.length > 0 && (
            <div className="patch-filter" ref={patchFilterRef}>
              <button className="draft-btn" onClick={() => setPatchOpen(o => !o)}>
                {selectedPatches.includes('all') ? 'All Patches' : selectedPatches.length === 1 ? `P ${selectedPatches[0]}` : `${selectedPatches.length} Patches`} {patchOpen ? '▲' : '▼'}
              </button>
              {patchOpen && (
                <div className="patch-filter-panel">
                  <label className="patch-filter-item">
                    <input type="checkbox" checked={selectedPatches.includes('all')} onChange={() => setSelectedPatches(['all'])} />
                    <span>All Patches</span>
                  </label>
                  {availablePatches.map(p => (
                    <label key={p} className="patch-filter-item">
                      <input type="checkbox" checked={selectedPatches.includes(p)} onChange={() => {
                        const without = selectedPatches.filter(v => v !== 'all');
                        const next = without.includes(p) ? without.filter(v => v !== p) : [...without, p];
                        setSelectedPatches(next.length === 0 ? ['all'] : next);
                      }} />
                      <span>Patch {p}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <button onClick={() => setHidePicked(h => !h)} className="draft-btn">{hidePicked ? 'Show Picked' : 'Hide Picked'}</button>
          <button onClick={handleUndo} disabled={step === 0} className="draft-btn">Undo</button>
          <button onClick={handleReset} className="draft-btn reset">Reset All</button>
        </div>
      </div>

      <div className="draft-body">
        <div className="draft-side blue-side">
          {b1Suggestions.length > 0 && (
            <div className="b1-hints-col">
              <span className="b1-hints-label">B1 Prio</span>
              {b1Suggestions.map(({ id, count }) => (
                <div key={id} className="b1-hint" onClick={() => handleSelect(id)} title={champMap.get(id) ?? id}>
                  <img src={`https://ddragon.leagueoflegends.com/cdn/${v}/img/champion/${id}.png`} alt={id} />
                  <span className="b1-hint-count">{count}×</span>
                </div>
              ))}
            </div>
          )}
          {b23Suggestions.length > 0 && (
            <div className="b23-hints-col">
              <span className="b1-hints-label">B2/B3 Prio</span>
              {b23Suggestions.map(({ a, b, count }) => (
                <div key={`${a}|||${b}`} className="r12-hint" onClick={() => handleB23Pick(a, b)}>
                  <div className="r12-hint-icons">
                    <img src={`https://ddragon.leagueoflegends.com/cdn/${v}/img/champion/${a}.png`} alt={a} title={champMap.get(a) ?? a} />
                    <img src={`https://ddragon.leagueoflegends.com/cdn/${v}/img/champion/${b}.png`} alt={b} title={champMap.get(b) ?? b} />
                  </div>
                  <span className="b1-hint-count">{count}×</span>
                </div>
              ))}
            </div>
          )}
          <div className="side-label blue-label">BLUE SIDE</div>
          <BanRow bans={draft.blueBans} activeSlot={activeBlueBan} editingSlot={editingSlot?.team === 'blue' && editingSlot.type === 'ban' ? editingSlot.slot : -1} version={v} onSlotClick={s => handleSlotClick('blue', 'ban', s)} />
          <PickCol picks={draft.bluePicks} activeSlot={activeBluePick} editingSlot={editingSlot?.team === 'blue' && editingSlot.type === 'pick' ? editingSlot.slot : -1} team="blue" version={v} champMap={champMap} onSlotClick={s => handleSlotClick('blue', 'pick', s)} />
        </div>

        <div className="draft-center">
          <ChampionGrid
            key={`grid-${resetKey}`}
            champions={champions}
            usedChampions={usedChampions}
            eliminatedChamps={eliminatedChamps}
            hiddenChamps={hidePicked ? new Set([
              ...draft.bluePicks.filter((c): c is string => c !== null),
              ...draft.redPicks.filter((c): c is string => c !== null),
              ...eliminatedChamps,
            ]) : undefined}
            onSelect={handleSelect}
            disabled={isDone && !editingSlot}
            version={v}
          />
          <CounterPanel
            key={`counter-${resetKey}`}
            champions={champions}
            version={v}
            autoChamp={autoChamp}
            autoAction={autoAction}
            onSelect={handleSelect}
            usedChampions={usedChampions}
            proCounters={proCounters}
            champMap={champMap}
          />
        </div>

        <div className="draft-side red-side">
          {r12Suggestions.length > 0 && (
            <div className="r12-hints-col">
              <span className="b1-hints-label">R1/R2 Prio</span>
              {r12Suggestions.map(({ a, b, count }) => (
                <div key={`${a}|||${b}`} className="r12-hint" onClick={() => handleDuoPick(a, b)}>
                  <div className="r12-hint-icons">
                    <img src={`https://ddragon.leagueoflegends.com/cdn/${v}/img/champion/${a}.png`} alt={a} title={champMap.get(a) ?? a} />
                    <img src={`https://ddragon.leagueoflegends.com/cdn/${v}/img/champion/${b}.png`} alt={b} title={champMap.get(b) ?? b} />
                  </div>
                  <span className="b1-hint-count">{count}×</span>
                </div>
              ))}
            </div>
          )}
          <div className="side-label red-label">RED SIDE</div>
          <BanRow bans={draft.redBans} activeSlot={activeRedBan} editingSlot={editingSlot?.team === 'red' && editingSlot.type === 'ban' ? editingSlot.slot : -1} version={v} onSlotClick={s => handleSlotClick('red', 'ban', s)} />
          <PickCol picks={draft.redPicks} activeSlot={activeRedPick} editingSlot={editingSlot?.team === 'red' && editingSlot.type === 'pick' ? editingSlot.slot : -1} team="red" version={v} champMap={champMap} onSlotClick={s => handleSlotClick('red', 'pick', s)} />
        </div>
      </div>

      {currentGame > 0 && (
        <div className="fearless-pool">
          {Array.from({ length: currentGame }, (_, gi) => {
            const d = gameDrafts[gi];
            const picks = [
              ...d.bluePicks.filter((c): c is string => c !== null),
              ...d.redPicks.filter((c): c is string => c !== null),
            ];
            if (picks.length === 0) return null;
            return (
              <div key={gi} className="fearless-game-row">
                <span className="fearless-game-label">G{gi + 1}</span>
                <div className="fearless-icons">
                  {picks.map(id => (
                    <img
                      key={id}
                      className="fearless-icon"
                      src={`https://ddragon.leagueoflegends.com/cdn/${v}/img/champion/${id}.png`}
                      alt={id}
                      title={champMap.get(id) ?? id}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
