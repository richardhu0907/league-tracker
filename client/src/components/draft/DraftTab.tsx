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

const EMPTY: DraftState = {
  blueBans:  [null, null, null, null, null],
  redBans:   [null, null, null, null, null],
  bluePicks: [null, null, null, null, null],
  redPicks:  [null, null, null, null, null],
};


interface BanRowProps {
  bans: (string | null)[];
  activeSlot: number;
  version: string;
}

function BanRow({ bans, activeSlot, version }: BanRowProps) {
  return (
    <div className="ban-row">
      {bans.map((id, i) => (
        <div key={i} className={`ban-slot ${id ? 'filled' : ''} ${i === activeSlot ? 'active' : ''}`}>
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
  team: 'blue' | 'red';
  version: string;
  champMap: Map<string, string>;
}

function PickCol({ picks, activeSlot, team, version, champMap }: PickColProps) {
  return (
    <div className="pick-col">
      {picks.map((id, i) => {
        const isActive = i === activeSlot;
        return (
          <div key={i} className={`pick-slot ${id ? 'filled' : ''} ${isActive ? `active ${team}-active` : ''}`}>
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
  const [draft, setDraft] = useState<DraftState>(EMPTY);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [autoChamp, setAutoChamp] = useState<ChampionData | null>(null);
  const [autoAction, setAutoAction] = useState<'pick' | 'ban'>('pick');

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

  const isDone = step >= DRAFT_ORDER.length;
  const current = isDone ? null : DRAFT_ORDER[step];

  const usedChampions = new Set<string>([
    ...draft.blueBans.filter((c): c is string => c !== null),
    ...draft.redBans.filter((c): c is string => c !== null),
    ...draft.bluePicks.filter((c): c is string => c !== null),
    ...draft.redPicks.filter((c): c is string => c !== null),
  ]);

  const handleSelect = (id: string) => {
    if (isDone || usedChampions.has(id) || !current) return;

    setDraft(prev => {
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
    setStep(s => s + 1);
    setAutoChamp(champions.find(c => c.id === id) ?? null);
    setAutoAction(current.type);
  };

  const handleUndo = () => {
    if (step === 0) return;
    const prev = DRAFT_ORDER[step - 1];
    setDraft(d => {
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
    setStep(s => s - 1);
    setAutoChamp(null);
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
        <div className="draft-phase">{getPhaseLabel(step)}</div>
        <div className={`draft-turn ${current?.team ?? 'done'}`}>
          {isDone
            ? '✓ Draft Complete'
            : `${current!.team === 'blue' ? 'Blue' : 'Red'} Side — ${current!.type === 'ban' ? 'Ban' : 'Pick'}`}
        </div>
        <div className="draft-controls">
          <button onClick={handleUndo} disabled={step === 0} className="draft-btn">
            Undo
          </button>
          <button onClick={() => { setDraft(EMPTY); setStep(0); setAutoChamp(null); }} className="draft-btn reset">
            Reset
          </button>
        </div>
      </div>

      <div className="draft-body">
        <div className="draft-side blue-side">
          <div className="side-label blue-label">BLUE SIDE</div>
          <BanRow bans={draft.blueBans} activeSlot={activeBlueBan} version={v} />
          <PickCol picks={draft.bluePicks} activeSlot={activeBluePick} team="blue" version={v} champMap={champMap} />
        </div>

        <div className="draft-center">
          <ChampionGrid
            champions={champions}
            usedChampions={usedChampions}
            onSelect={handleSelect}
            disabled={isDone}
            version={v}
          />
          <CounterPanel
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
          <BanRow bans={draft.redBans} activeSlot={activeRedBan} version={v} />
          <PickCol picks={draft.redPicks} activeSlot={activeRedPick} team="red" version={v} champMap={champMap} />
        </div>
      </div>
    </div>
  );
}
