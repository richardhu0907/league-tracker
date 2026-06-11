import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getDDragonVersion } from '../api/riot';
import '../ProMatches.css';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/promatches`;

const TOURNAMENTS = [
  { label: 'LCS Spring',           page: 'LCS 2026 Spring' },
  { label: 'LCS Playoffs',         page: 'LCS 2026 Spring Playoffs' },
  { label: 'LEC Spring',           page: 'LEC 2026 Spring' },
  { label: 'LEC Playoffs',         page: 'LEC 2026 Spring Playoffs' },
  { label: 'LPL Split 2',          page: 'LPL 2026 Split 2' },
  { label: 'LPL Split 2 Playoffs', page: 'LPL 2026 Split 2 Playoffs' },
  { label: 'LCK Rounds 1-2',       page: 'LCK 2026 Rounds 1-2' },
  { label: 'LCK Road to MSI',      page: 'LCK 2026 Road to MSI' },
];

function useSelectedTournaments() {
  const [selected, setSelected] = useState<string[]>(['all']);

  function toggle(page: string) {
    if (page === 'all') { setSelected(['all']); return; }
    setSelected(prev => {
      const without = prev.filter(p => p !== 'all');
      const next = without.includes(page)
        ? without.filter(p => p !== page)
        : [...without, page];
      return next.length === 0 ? ['all'] : next;
    });
  }

  const activePages = selected.includes('all') ? TOURNAMENTS.map(t => t.page) : selected;
  return { selected, toggle, activePages };
}


function TournamentDropdown({ selected, onToggle }: { selected: string[]; onToggle: (p: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const label = selected.includes('all')
    ? 'All Tournaments'
    : selected.length === 1
    ? TOURNAMENTS.find(t => t.page === selected[0])?.label ?? selected[0]
    : `${selected.length} Tournaments`;

  return (
    <div className="pp-dropdown" ref={ref}>
      <button className="pp-dropdown-trigger" onClick={() => setOpen(o => !o)}>
        <span>{label}</span>
        <span className="pp-dropdown-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="pp-dropdown-panel">
          <label className="pp-dropdown-item">
            <input type="checkbox" checked={selected.includes('all')} onChange={() => onToggle('all')} />
            <span>All Tournaments</span>
          </label>
          {TOURNAMENTS.map(t => (
            <label key={t.page} className="pp-dropdown-item">
              <input type="checkbox" checked={selected.includes(t.page)} onChange={() => onToggle(t.page)} />
              <span>{t.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function PatchDropdown({ patches, selected, onChange }: {
  patches: string[];
  selected: string[];
  onChange: (vals: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  function toggle(val: string) {
    if (val === 'all') { onChange(['all']); return; }
    const without = selected.filter(v => v !== 'all');
    const next = without.includes(val) ? without.filter(v => v !== val) : [...without, val];
    onChange(next.length === 0 ? ['all'] : next);
  }

  const label = selected.includes('all')
    ? 'All Patches'
    : selected.length === 1
    ? `Patch ${selected[0]}`
    : `${selected.length} Patches`;

  return (
    <div className="pp-dropdown" ref={ref}>
      <button className="pp-dropdown-trigger" onClick={() => setOpen(o => !o)}>
        <span>{label}</span>
        <span className="pp-dropdown-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="pp-dropdown-panel">
          {patches.map(p => {
            const checked = p === 'all' ? selected.includes('all') : selected.includes(p);
            return (
              <label key={p} className="pp-dropdown-item">
                <input type="checkbox" checked={checked} onChange={() => toggle(p)} />
                <span>{p === 'all' ? 'All Patches' : `Patch ${p}`}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

const CHAMP_OVERRIDES: Record<string, string> = {
  'Wukong': 'MonkeyKing',
  'Renata Glasc': 'Renata',
  "Bel'Veth": 'Belveth',
  'Nunu & Willump': 'Nunu',
  "Cho'Gath": 'Chogath',
  "Vel'Koz": 'Velkoz',
  "Kog'Maw": 'KogMaw',
  "Rek'Sai": 'RekSai',
  "Kha'Zix": 'Khazix',
  "Kai'Sa": 'Kaisa',
  "K'Sante": 'KSante',
  "Dr. Mundo": 'DrMundo',
};

function champId(name: string): string {
  if (!name) return '';
  if (CHAMP_OVERRIDES[name]) return CHAMP_OVERRIDES[name];
  return name.replace(/['\s.]/g, '');
}

function cleanName(name: string): string {
  return name.replace(/\s*\(.*\)$/, '').trim();
}

function gameNum(score: string): number {
  const parts = score.split('-').map(s => parseInt(s.trim(), 10));
  return parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) ? parts[0] + parts[1] : 0;
}

function gameLabel(score: string): string {
  const n = gameNum(score);
  return n > 0 ? `Game ${n}` : score;
}

interface SeriesGroup {
  t1: string;
  t2: string;
  t1Wins: number;
  t2Wins: number;
  games: ProGame[];
}

function groupIntoSeries(games: ProGame[]): SeriesGroup[] {
  const map = new Map<string, SeriesGroup>();
  for (const game of games) {
    const a = cleanName(game.team1);
    const b = cleanName(game.team2);
    const [t1, t2] = a <= b ? [a, b] : [b, a];
    const key = `${t1}|||${t2}`;
    if (!map.has(key)) map.set(key, { t1, t2, t1Wins: 0, t2Wins: 0, games: [] });
    const s = map.get(key)!;
    s.games.push(game);
    const w = cleanName(game.winner);
    if (w === t1) s.t1Wins++;
    else if (w === t2) s.t2Wins++;
  }
  for (const s of map.values()) s.games.sort((a, b) => gameNum(a.score) - gameNum(b.score));
  return [...map.values()];
}

interface DraftSlot {
  slot: number;
  action: 'pick' | 'ban';
  team: 1 | 2;
  champion: string;
  role?: string;
}

interface ProGame {
  phase: string;
  team1: string;
  team2: string;
  score: string;
  winner: string;
  patch: string;
  draft: DraftSlot[];
}

function ChampIcon({ name, size = 36, isBan = false }: { name: string; size?: number; isBan?: boolean }) {
  const v = getDDragonVersion();
  const id = champId(name);
  if (!id) return <div className="pm-champ-icon pm-champ-empty" style={{ width: size, height: size }} />;
  return (
    <div className={`pm-champ-icon${isBan ? ' pm-champ-ban' : ''}`} style={{ width: size, height: size }} title={name}>
      <img
        src={`https://ddragon.leagueoflegends.com/cdn/${v}/img/champion/${id}.png`}
        alt={name}
        onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
      />
    </div>
  );
}

const BAN_ORDER: Record<number, number> = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6,
  13: 7, 14: 8, 15: 9, 16: 10,
};

const PICK_ROUND: Record<number, string> = {
  7: '1',
  8: '2', 9: '2',
  10: '3', 11: '3', 12: 'R3',
  17: 'R4', 18: '4', 19: '4',
  20: '5',
};

function BanIcon({ slot, champion }: { slot: number; champion: string }) {
  return (
    <div className="pm-ban-item">
      <ChampIcon name={champion} size={30} isBan />
      <span className="pm-ban-num">{BAN_ORDER[slot]}</span>
    </div>
  );
}

function DraftBoard({ draft, team1, team2 }: { draft: DraftSlot[]; team1: string; team2: string }) {
  const bySlot = Object.fromEntries(draft.map(d => [d.slot, d]));

  const t1BanSlots = [1, 3, 5, 14, 16];
  const t2BanSlots = [2, 4, 6, 13, 15];
  const t1Picks = [7, 10, 11, 18, 19].map(s => bySlot[s]);
  const t2Picks = [8, 9, 12, 17, 20].map(s => bySlot[s]);

  return (
    <div className="pm-draft-board">
      <div className="pm-draft-bans">
        <div className="pm-bans-side">
          <div className="pm-bans-team-label pm-blue-label">{cleanName(team1)}</div>
          <div className="pm-bans-icons">
            {t1BanSlots.map(s => <BanIcon key={s} slot={s} champion={bySlot[s]?.champion ?? ''} />)}
          </div>
        </div>
        <div className="pm-bans-center-label">BANS</div>
        <div className="pm-bans-side pm-bans-right">
          <div className="pm-bans-icons">
            {t2BanSlots.map(s => <BanIcon key={s} slot={s} champion={bySlot[s]?.champion ?? ''} />)}
          </div>
          <div className="pm-bans-team-label pm-red-label">{cleanName(team2)}</div>
        </div>
      </div>

      <div className="pm-draft-picks">
        <div className="pm-picks-col">
          <div className="pm-picks-header pm-blue-header">{cleanName(team1)}</div>
          {t1Picks.map((p, i) => (
            <div key={i} className="pm-pick-row">
              <span className="pm-slot-num">{p?.slot ? PICK_ROUND[p.slot] : '–'}</span>
              <ChampIcon name={p?.champion ?? ''} size={40} />
              <div className="pm-pick-info">
                <span className="pm-pick-name">{p?.champion ?? '—'}</span>
                {p?.role && <span className="pm-pick-role">{p.role}</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="pm-picks-col pm-picks-col-right">
          <div className="pm-picks-header pm-red-header">{cleanName(team2)}</div>
          {t2Picks.map((p, i) => (
            <div key={i} className="pm-pick-row pm-pick-row-right">
              <div className="pm-pick-info pm-pick-info-right">
                <span className="pm-pick-name">{p?.champion ?? '—'}</span>
                {p?.role && <span className="pm-pick-role">{p.role}</span>}
              </div>
              <ChampIcon name={p?.champion ?? ''} size={40} />
              <span className="pm-slot-num">{p?.slot ? PICK_ROUND[p.slot] : '–'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GameRow({ game }: { game: ProGame }) {
  const [expanded, setExpanded] = useState(false);
  const t1 = cleanName(game.team1);
  const t2 = cleanName(game.team2);
  const isT1Win = game.winner === game.team1;
  const isT2Win = game.winner === game.team2;

  return (
    <div className="pm-game-row">
      <button className="pm-game-summary" onClick={() => setExpanded(e => !e)}>
        <div className={`pm-team pm-team-left${isT1Win ? ' pm-winner' : ' pm-loser'}`}>
          {isT1Win && <span className="pm-win-badge">W</span>}
          <span className="pm-team-name">{t1}</span>
        </div>
        <div className="pm-score-center">
          <span className="pm-score">{gameLabel(game.score)}</span>
          <span className="pm-patch">{game.score}</span>
          <span className="pm-patch">Patch {game.patch}</span>
        </div>
        <div className={`pm-team pm-team-right${isT2Win ? ' pm-winner' : ' pm-loser'}`}>
          <span className="pm-team-name">{t2}</span>
          {isT2Win && <span className="pm-win-badge">W</span>}
        </div>
        <span className="pm-expand-chevron">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="pm-draft-wrap">
          <DraftBoard draft={game.draft} team1={game.team1} team2={game.team2} />
        </div>
      )}
    </div>
  );
}

function SeriesBlock({ series }: { series: SeriesGroup }) {
  const t1Won = series.t1Wins > series.t2Wins;
  const winner = t1Won ? series.t1 : series.t2;
  const loser  = t1Won ? series.t2 : series.t1;
  const wScore = t1Won ? series.t1Wins : series.t2Wins;
  const lScore = t1Won ? series.t2Wins : series.t1Wins;
  return (
    <div className="pm-series-block">
      <div className="pm-series-header">
        <span className="pm-series-winner">{winner}</span>
        <span className="pm-series-score">{wScore} – {lScore}</span>
        <span className="pm-series-loser">{loser}</span>
      </div>
      {series.games.map((g, i) => <GameRow key={i} game={g} />)}
    </div>
  );
}

export default function ProMatchesTab() {
  const [tournament, setTournament] = useState(TOURNAMENTS[0]);
  const [games, setGames] = useState<ProGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    setGames([]);
    axios.get<ProGame[]>(`${BASE}/games`, { params: { page: tournament.page } })
      .then(r => setGames(r.data))
      .catch(err => setError(err.response?.data?.error ?? 'Failed to load matches'))
      .finally(() => setLoading(false));
  }, [tournament]);

  const grouped = games.reduce<Record<string, ProGame[]>>((acc, g) => {
    (acc[g.phase] ??= []).push(g);
    return acc;
  }, {});

  return (
    <div className="pm-container">
      <select
        className="pm-tournament-select"
        value={tournament.page}
        onChange={e => setTournament(TOURNAMENTS.find(t => t.page === e.target.value)!)}
      >
        {TOURNAMENTS.map(t => (
          <option key={t.page} value={t.page}>{t.label}</option>
        ))}
      </select>

      {loading && <div className="loading">Loading match data...</div>}
      {error && <div className="error-msg">{error}</div>}
      {!loading && !error && games.length === 0 && (
        <div className="loading">No matches found.</div>
      )}

      {Object.entries(grouped).map(([phase, phaseGames]) => (
        <section key={phase} className="pm-phase-section">
          <h3 className="pm-phase-header">{phase}</h3>
          {groupIntoSeries(phaseGames).map(s => (
            <SeriesBlock key={`${s.t1}|||${s.t2}`} series={s} />
          ))}
        </section>
      ))}
    </div>
  );
}

export function PrioPicksTab() {
  const { selected, toggle, activePages } = useSelectedTournaments();
  const [games, setGames] = useState<ProGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPatches, setSelectedPatches] = useState<string[]>(['all']);

  useEffect(() => {
    setLoading(true);
    setError('');
    setGames([]);
    Promise.all(activePages.map(page =>
      axios.get<ProGame[]>(`${BASE}/games`, { params: { page } }).then(r => r.data)
    ))
      .then(results => setGames(results.flat()))
      .catch(err => setError(err.response?.data?.error ?? 'Failed to load matches'))
      .finally(() => setLoading(false));
  }, [activePages.join(',')]);

  const availablePatches = Array.from(new Set(games.map(g => g.patch))).sort().reverse();
  const patches = ['all', ...availablePatches];

  useEffect(() => {
    if (selectedPatches.includes('all')) return;
    const available = new Set(availablePatches);
    const stillValid = selectedPatches.filter(p => available.has(p));
    if (stillValid.length === 0) setSelectedPatches(['all']);
    else if (stillValid.length !== selectedPatches.length) setSelectedPatches(stillValid);
  }, [availablePatches.join(',')]);

  const filtered = selectedPatches.includes('all') ? games : games.filter(g => selectedPatches.includes(g.patch));

  const counts = new Map<string, number>();
  const comboCounts = new Map<string, { a: string; b: string; count: number }>();

  for (const game of filtered) {
    const slot7 = game.draft.find(d => d.slot === 7)?.champion;
    if (slot7) counts.set(slot7, (counts.get(slot7) ?? 0) + 1);

    const slot8 = game.draft.find(d => d.slot === 8)?.champion;
    const slot9 = game.draft.find(d => d.slot === 9)?.champion;
    if (slot8 && slot9) {
      const [a, b] = [slot8, slot9].sort();
      const key = `${a}|||${b}`;
      if (!comboCounts.has(key)) comboCounts.set(key, { a, b, count: 0 });
      comboCounts.get(key)!.count++;
    }
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const combos = [...comboCounts.values()].filter(c => c.count >= 3).sort((a, b) => b.count - a.count);

  const [selectedB1, setSelectedB1] = useState<string | null>(null);

  const answersByRole = (() => {
    if (!selectedB1) return [];
    const roleMap = new Map<string, Map<string, number>>();
    for (const game of filtered) {
      const b1 = game.draft.find(d => d.slot === 7);
      if (b1?.champion !== selectedB1) continue;
      const role = b1.role ?? '';
      if (!roleMap.has(role)) roleMap.set(role, new Map());
      const opposing = game.draft.find(d => d.action === 'pick' && d.team === 2 && d.role === role);
      if (opposing?.champion) {
        const m = roleMap.get(role)!;
        m.set(opposing.champion, (m.get(opposing.champion) ?? 0) + 1);
      }
    }
    return [...roleMap.entries()]
      .map(([role, counts]) => ({
        role,
        answers: [...counts.entries()].map(([champ, count]) => ({ champ, count })).sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.answers.reduce((s, x) => s + x.count, 0) - a.answers.reduce((s, x) => s + x.count, 0));
  })();

  return (
    <div className="pm-container">
      <div className="pp-filters">
        <TournamentDropdown selected={selected} onToggle={toggle} />
        <PatchDropdown patches={patches} selected={selectedPatches} onChange={setSelectedPatches} />
      </div>

      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error-msg">{error}</div>}

      {!loading && !error && sorted.length > 0 && (
        selectedB1 ? (
          <div>
            <button className="pp-back-btn" onClick={() => setSelectedB1(null)}>
              ← Back
            </button>
            <div className="pp-detail-header">
              <ChampIcon name={selectedB1} size={48} />
              <div className="pp-detail-name">{selectedB1}</div>
            </div>
            {answersByRole.map(({ role, answers }) => (
              <div key={role} className="pp-answers-section">
                <div className="pp-section-label">{selectedB1} {role} answers</div>
                <div className="pp-answers-grid">
                  {answers.map(({ champ, count }) => (
                    <div key={champ} className="pp-answer-card">
                      <ChampIcon name={champ} size={52} />
                      <span className="pp-answer-name">{champ}</span>
                      <span className="pp-answer-count">{count}×</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="pp-columns">
            <div>
              <div className="pp-section-label">B1</div>
              <div className="pp-list">
                {sorted.map(([champ, count], i) => (
                  <div
                    key={champ}
                    className="pp-row pp-row-clickable"
                    onClick={() => setSelectedB1(champ)}
                  >
                    <span className="pp-rank">{i + 1}</span>
                    <ChampIcon name={champ} size={36} />
                    <span className="pp-name">{champ}</span>
                    <span className="pp-count">{count}×</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="pp-section-label">R1/R2</div>
              <div className="pp-list">
                {combos.map(({ a, b, count }, i) => (
                  <div key={`${a}|||${b}`} className="pp-row">
                    <span className="pp-rank">{i + 1}</span>
                    <ChampIcon name={a} size={36} />
                    <ChampIcon name={b} size={36} />
                    <span className="pp-count">{count}×</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
