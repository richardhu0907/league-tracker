import { useState, useEffect } from 'react';
import { ChampionData, DraftAction, DraftState } from '../../types';
import ChampionGrid from './ChampionGrid';
import CounterPanel from './CounterPanel';

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

function getPhaseLabel(step: number): string {
  if (step >= 20) return 'Draft Complete';
  if (step >= 16) return 'Pick Phase 2';
  if (step >= 12) return 'Ban Phase 2';
  if (step >= 6)  return 'Pick Phase 1';
  return 'Ban Phase 1';
}

const EMPTY_DRAFT: DraftState = {
  blueBans:  [null, null, null, null, null],
  redBans:   [null, null, null, null, null],
  bluePicks: [null, null, null, null, null],
  redPicks:  [null, null, null, null, null],
};

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
                  className="pick-icon"
                />
                <span className="pick-name">{champMap.get(id) ?? id}</span>
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

  const usedChampions = new Set<string>([
    ...draft.blueBans.filter((c): c is string => c !== null),
    ...draft.redBans.filter((c): c is string => c !== null),
    ...draft.bluePicks.filter((c): c is string => c !== null),
    ...draft.redPicks.filter((c): c is string => c !== null),
  ]);
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
          <button onClick={() => setHidePicked(h => !h)} className="draft-btn">{hidePicked ? 'Show Picked' : 'Hide Picked'}</button>
          <button onClick={handleUndo} disabled={step === 0} className="draft-btn">Undo</button>
          <button onClick={handleReset} className="draft-btn reset">Reset All</button>
        </div>
      </div>

      <div className="draft-body">
        <div className="draft-side blue-side">
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
          />
        </div>

        <div className="draft-side red-side">
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
