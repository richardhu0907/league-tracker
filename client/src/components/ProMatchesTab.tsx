import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getDDragonVersion } from '../api/riot';
import { champId } from '../utils/champId';
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

type TaggedGame = ProGame & { _page: string };

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
  const [games, setGames] = useState<TaggedGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPatches, setSelectedPatches] = useState<string[]>(['all']);

  useEffect(() => {
    setLoading(true);
    setError('');
    setGames([]);
    Promise.all(activePages.map(page =>
      axios.get<ProGame[]>(`${BASE}/games`, { params: { page } })
        .then(r => r.data.map(g => ({ ...g, _page: page } as TaggedGame)))
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
  const b23Counts  = new Map<string, { a: string; b: string; count: number }>();

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

    const slot10 = game.draft.find(d => d.slot === 10)?.champion;
    const slot11 = game.draft.find(d => d.slot === 11)?.champion;
    if (slot10 && slot11) {
      const [a, b] = [slot10, slot11].sort();
      const key = `${a}|||${b}`;
      if (!b23Counts.has(key)) b23Counts.set(key, { a, b, count: 0 });
      b23Counts.get(key)!.count++;
    }
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const combos = [...comboCounts.values()].filter(c => c.count >= 3).sort((a, b) => b.count - a.count);
  const b23combos = [...b23Counts.values()].filter(c => c.count >= 3).sort((a, b) => b.count - a.count);

  const [selectedB1, setSelectedB1] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

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

  const answerGames = (() => {
    if (!selectedB1 || !selectedAnswer) return [];
    return filtered.filter(game => {
      const b1 = game.draft.find(d => d.slot === 7);
      if (b1?.champion !== selectedB1) return false;
      const role = b1.role ?? '';
      const opposing = game.draft.find(d => d.action === 'pick' && d.team === 2 && d.role === role);
      return opposing?.champion === selectedAnswer;
    });
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
        selectedB1 && selectedAnswer ? (
          <GameList games={answerGames} onBack={() => setSelectedAnswer(null)} />
        ) : selectedB1 ? (
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
                    <div key={champ} className="pp-answer-card pp-row-clickable" onClick={() => setSelectedAnswer(champ)}>
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

            <div>
              <div className="pp-section-label">B2/B3</div>
              <div className="pp-list">
                {b23combos.map(({ a, b, count }, i) => (
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

type ComboType = 'Mid/Jg' | 'Bot/Sup' | 'Jg/Sup';
type MatchupKind = 'into' | 'before' | 'general';

const COMBO_ROLES: Record<ComboType, [string, string]> = {
  'Mid/Jg':  ['Mid', 'Jungle'],
  'Bot/Sup': ['Bot', 'Support'],
  'Jg/Sup':  ['Jungle', 'Support'],
};

function GameList({ games, onBack }: { games: TaggedGame[]; onBack: () => void }) {
  return (
    <div>
      <button className="pp-back-btn" onClick={onBack}>← Back</button>
      <div className="pp-game-list">
        {games.map((game, i) => {
          const tourney = TOURNAMENTS.find(t => t.page === game._page)?.label ?? game._page;
          return (
            <div key={i} className="pp-game-row">
              <span className="pp-game-tourney">{tourney}</span>
              <span className="pp-game-phase">{game.phase}</span>
              <span className="pp-game-teams">{cleanName(game.team1)} vs {cleanName(game.team2)}</span>
              <span className="pp-game-num">{gameLabel(game.score)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MatchupSection({
  label, pairs, onSelect,
}: {
  label: string;
  pairs: { a: string; b: string; count: number }[];
  onSelect: (a: string, b: string) => void;
}) {
  if (pairs.length === 0) return null;
  const total = pairs.reduce((s, x) => s + x.count, 0);
  return (
    <div className="pp-answers-section">
      <div className="pp-section-label">{label} ({total} games)</div>
      <div className="pp-answers-grid">
        {pairs.map(({ a, b, count }) => (
          <div key={`${a}|||${b}`} className="pp-answer-card pp-row-clickable" onClick={() => onSelect(a, b)}>
            <div className="pp-combo-card-icons">
              <ChampIcon name={a} size={36} />
              <ChampIcon name={b} size={36} />
            </div>
            <span className="pp-answer-name">{a}</span>
            <span className="pp-combo-card-b">{b}</span>
            <span className="pp-answer-count">{count}×</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CombosTab() {
  const { selected, toggle, activePages } = useSelectedTournaments();
  const [games, setGames] = useState<TaggedGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPatches, setSelectedPatches] = useState<string[]>(['all']);
  const [comboType, setComboType] = useState<ComboType>('Mid/Jg');
  const [selectedCombo, setSelectedCombo] = useState<{ a: string; b: string } | null>(null);
  const [selectedMatchup, setSelectedMatchup] = useState<{ a: string; b: string; kind: MatchupKind } | null>(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    setGames([]);
    Promise.all(activePages.map(page =>
      axios.get<ProGame[]>(`${BASE}/games`, { params: { page } })
        .then(r => r.data.map(g => ({ ...g, _page: page } as TaggedGame)))
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

  const [roleA, roleB] = COMBO_ROLES[comboType];

  const comboCounts = new Map<string, { a: string; b: string; count: number }>();
  for (const game of filtered) {
    for (const teamNum of [1, 2] as const) {
      const teamPicks = game.draft.filter(d => d.action === 'pick' && d.team === teamNum);
      const byRole = new Map<string, string>();
      for (const p of teamPicks) {
        if (p.role) byRole.set(p.role, p.champion);
      }
      const champA = byRole.get(roleA);
      const champB = byRole.get(roleB);
      if (champA && champB) {
        const [a, b] = [champA, champB].sort();
        const key = `${a}|||${b}`;
        if (!comboCounts.has(key)) comboCounts.set(key, { a, b, count: 0 });
        comboCounts.get(key)!.count++;
      }
    }
  }
  const combos = [...comboCounts.values()].sort((a, b) => b.count - a.count);

  const matchupSections = (() => {
    if (!selectedCombo) return null;
    const comboSet = new Set([selectedCombo.a, selectedCombo.b]);

    const into    = new Map<string, { a: string; b: string; count: number }>();
    const before  = new Map<string, { a: string; b: string; count: number }>();
    const general = new Map<string, { a: string; b: string; count: number }>();

    for (const game of filtered) {
      for (const teamNum of [1, 2] as const) {
        const teamPicks = game.draft.filter(d => d.action === 'pick' && d.team === teamNum);
        const byRole = new Map<string, DraftSlot>();
        for (const p of teamPicks) { if (p.role) byRole.set(p.role, p); }

        const pickA = byRole.get(roleA);
        const pickB = byRole.get(roleB);
        if (!pickA || !pickB) continue;
        if (!comboSet.has(pickA.champion) || !comboSet.has(pickB.champion)) continue;

        const enemyNum = teamNum === 1 ? 2 : 1;
        const enemyPicks = game.draft.filter(d => d.action === 'pick' && d.team === enemyNum);
        const enemyByRole = new Map<string, DraftSlot>();
        for (const p of enemyPicks) { if (p.role) enemyByRole.set(p.role, p); }

        const enemyA = enemyByRole.get(roleA);
        const enemyB = enemyByRole.get(roleB);
        if (!enemyA || !enemyB) continue;

        const comboMin = Math.min(pickA.slot, pickB.slot);
        const comboMax = Math.max(pickA.slot, pickB.slot);
        const enemyMin = Math.min(enemyA.slot, enemyB.slot);
        const enemyMax = Math.max(enemyA.slot, enemyB.slot);

        const [ea, eb] = [enemyA.champion, enemyB.champion].sort();
        const key = `${ea}|||${eb}`;

        let section: typeof into;
        if (enemyMin > comboMax) section = into;
        else if (enemyMax < comboMin) section = before;
        else section = general;

        if (!section.has(key)) section.set(key, { a: ea, b: eb, count: 0 });
        section.get(key)!.count++;
      }
    }

    const sort = (m: typeof into) => [...m.values()].sort((x, y) => y.count - x.count);
    return { into: sort(into), before: sort(before), general: sort(general) };
  })();

  const matchupGames = (() => {
    if (!selectedCombo || !selectedMatchup) return [];
    const comboSet   = new Set([selectedCombo.a, selectedCombo.b]);
    const matchupSet = new Set([selectedMatchup.a, selectedMatchup.b]);
    const result: TaggedGame[] = [];
    for (const game of filtered) {
      for (const teamNum of [1, 2] as const) {
        const teamPicks = game.draft.filter(d => d.action === 'pick' && d.team === teamNum);
        const byRole = new Map<string, DraftSlot>();
        for (const p of teamPicks) { if (p.role) byRole.set(p.role, p); }
        const pickA = byRole.get(roleA);
        const pickB = byRole.get(roleB);
        if (!pickA || !pickB) continue;
        if (!comboSet.has(pickA.champion) || !comboSet.has(pickB.champion)) continue;
        const enemyNum = teamNum === 1 ? 2 : 1;
        const enemyPicks = game.draft.filter(d => d.action === 'pick' && d.team === enemyNum);
        const enemyByRole = new Map<string, DraftSlot>();
        for (const p of enemyPicks) { if (p.role) enemyByRole.set(p.role, p); }
        const enemyA = enemyByRole.get(roleA);
        const enemyB = enemyByRole.get(roleB);
        if (!enemyA || !enemyB) continue;
        if (!matchupSet.has(enemyA.champion) || !matchupSet.has(enemyB.champion)) continue;
        const comboMin = Math.min(pickA.slot, pickB.slot);
        const comboMax = Math.max(pickA.slot, pickB.slot);
        const enemyMin = Math.min(enemyA.slot, enemyB.slot);
        const enemyMax = Math.max(enemyA.slot, enemyB.slot);
        let kind: MatchupKind;
        if (enemyMin > comboMax) kind = 'into';
        else if (enemyMax < comboMin) kind = 'before';
        else kind = 'general';
        if (kind === selectedMatchup.kind) result.push(game);
      }
    }
    return result;
  })();

  return (
    <div className="pm-container">
      <div className="pp-filters">
        <TournamentDropdown selected={selected} onToggle={toggle} />
        <PatchDropdown patches={patches} selected={selectedPatches} onChange={setSelectedPatches} />
        <div className="pp-type-tabs">
          {(['Mid/Jg', 'Bot/Sup', 'Jg/Sup'] as const).map(type => (
            <button
              key={type}
              className={`pp-type-tab${comboType === type ? ' active' : ''}`}
              onClick={() => { setComboType(type); setSelectedCombo(null); setSelectedMatchup(null); }}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error-msg">{error}</div>}

      {!loading && !error && (
        selectedCombo && selectedMatchup ? (
          <div>
            <button className="pp-back-btn" onClick={() => setSelectedMatchup(null)}>← Back</button>
            <div className="pp-detail-header">
              <ChampIcon name={selectedCombo.a} size={40} />
              <ChampIcon name={selectedCombo.b} size={40} />
              <span className="pp-detail-name" style={{ fontSize: '1rem' }}>
                {selectedCombo.a} + {selectedCombo.b}
              </span>
              <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>vs</span>
              <ChampIcon name={selectedMatchup.a} size={40} />
              <ChampIcon name={selectedMatchup.b} size={40} />
              <span className="pp-detail-name" style={{ fontSize: '1rem' }}>
                {selectedMatchup.a} + {selectedMatchup.b}
              </span>
            </div>
            <div className="pp-game-list">
              {matchupGames.map((game, i) => {
                const tourney = TOURNAMENTS.find(t => t.page === game._page)?.label ?? game._page;
                return (
                  <div key={i} className="pp-game-row">
                    <span className="pp-game-tourney">{tourney}</span>
                    <span className="pp-game-phase">{game.phase}</span>
                    <span className="pp-game-teams">{cleanName(game.team1)} vs {cleanName(game.team2)}</span>
                    <span className="pp-game-num">{gameLabel(game.score)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : selectedCombo && matchupSections ? (
          <div>
            <button className="pp-back-btn" onClick={() => { setSelectedCombo(null); setSelectedMatchup(null); }}>← Back</button>
            <div className="pp-detail-header">
              <ChampIcon name={selectedCombo.a} size={48} />
              <ChampIcon name={selectedCombo.b} size={48} />
              <div className="pp-detail-name">{selectedCombo.a} + {selectedCombo.b}</div>
            </div>
            <MatchupSection
              label={`Picked into ${selectedCombo.a} + ${selectedCombo.b}`}
              pairs={matchupSections.into}
              onSelect={(a, b) => setSelectedMatchup({ a, b, kind: 'into' })}
            />
            <MatchupSection
              label={`Picked before ${selectedCombo.a} + ${selectedCombo.b}`}
              pairs={matchupSections.before}
              onSelect={(a, b) => setSelectedMatchup({ a, b, kind: 'before' })}
            />
            <MatchupSection
              label="General Matchup"
              pairs={matchupSections.general}
              onSelect={(a, b) => setSelectedMatchup({ a, b, kind: 'general' })}
            />
            {matchupSections.into.length === 0 && matchupSections.before.length === 0 && matchupSections.general.length === 0 && (
              <div className="loading">No matchup data found.</div>
            )}
          </div>
        ) : (
          <div className="pp-list">
            {combos.length === 0
              ? <div className="loading">No combos found.</div>
              : combos.map(({ a, b, count }, i) => (
                <div key={`${a}|||${b}`} className="pp-row pp-row-clickable" onClick={() => { setSelectedCombo({ a, b }); setSelectedMatchup(null); }}>
                  <span className="pp-rank">{i + 1}</span>
                  <ChampIcon name={a} size={36} />
                  <span className="pp-name">{a}</span>
                  <span className="pp-combo-sep">+</span>
                  <ChampIcon name={b} size={36} />
                  <span className="pp-name">{b}</span>
                  <span className="pp-count">{count}×</span>
                </div>
              ))
            }
          </div>
        )
      )}
    </div>
  );
}

export function CounterPicksTab() {
  const { selected, toggle, activePages } = useSelectedTournaments();
  const [games, setGames] = useState<TaggedGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPatches, setSelectedPatches] = useState<string[]>(['all']);
  const [selectedChamp, setSelectedChamp] = useState<string | null>(null);
  const [selectedCounter, setSelectedCounter] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    setGames([]);
    Promise.all(activePages.map(page =>
      axios.get<ProGame[]>(`${BASE}/games`, { params: { page } })
        .then(r => r.data.map(g => ({ ...g, _page: page } as TaggedGame)))
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

  const blindCounts = new Map<string, number>();
  for (const game of filtered) {
    const picks = game.draft.filter(d => d.action === 'pick' && d.role);
    const byRole = new Map<string, DraftSlot[]>();
    for (const p of picks) {
      if (!byRole.has(p.role!)) byRole.set(p.role!, []);
      byRole.get(p.role!)!.push(p);
    }
    for (const rolePicks of byRole.values()) {
      if (rolePicks.length < 2) continue;
      rolePicks.sort((a, b) => a.slot - b.slot);
      blindCounts.set(rolePicks[0].champion, (blindCounts.get(rolePicks[0].champion) ?? 0) + 1);
    }
  }

  const sortedBlinds = [...blindCounts.entries()].sort((a, b) => b[1] - a[1]);

  const countersByRole = (() => {
    if (!selectedChamp) return [];
    const roleMap = new Map<string, Map<string, number>>();
    for (const game of filtered) {
      const picks = game.draft.filter(d => d.action === 'pick' && d.role);
      const byRole = new Map<string, DraftSlot[]>();
      for (const p of picks) {
        if (!byRole.has(p.role!)) byRole.set(p.role!, []);
        byRole.get(p.role!)!.push(p);
      }
      for (const [role, rolePicks] of byRole) {
        if (rolePicks.length < 2) continue;
        rolePicks.sort((a, b) => a.slot - b.slot);
        if (rolePicks[0].champion !== selectedChamp) continue;
        const counter = rolePicks[1].champion;
        if (!roleMap.has(role)) roleMap.set(role, new Map());
        const m = roleMap.get(role)!;
        m.set(counter, (m.get(counter) ?? 0) + 1);
      }
    }
    return [...roleMap.entries()]
      .map(([role, counts]) => ({
        role,
        counters: [...counts.entries()]
          .map(([champ, count]) => ({ champ, count }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) =>
        b.counters.reduce((s, x) => s + x.count, 0) -
        a.counters.reduce((s, x) => s + x.count, 0)
      );
  })();

  const counterGames = (() => {
    if (!selectedChamp || !selectedCounter) return [];
    return filtered.filter(game => {
      const picks = game.draft.filter(d => d.action === 'pick' && d.role);
      const byRole = new Map<string, DraftSlot[]>();
      for (const p of picks) {
        if (!byRole.has(p.role!)) byRole.set(p.role!, []);
        byRole.get(p.role!)!.push(p);
      }
      for (const rolePicks of byRole.values()) {
        if (rolePicks.length < 2) continue;
        rolePicks.sort((a, b) => a.slot - b.slot);
        if (rolePicks[0].champion === selectedChamp && rolePicks[1].champion === selectedCounter) return true;
      }
      return false;
    });
  })();

  return (
    <div className="pm-container">
      <div className="pp-filters">
        <TournamentDropdown selected={selected} onToggle={toggle} />
        <PatchDropdown patches={patches} selected={selectedPatches} onChange={setSelectedPatches} />
      </div>

      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error-msg">{error}</div>}

      {!loading && !error && sortedBlinds.length > 0 && (
        selectedChamp && selectedCounter ? (
          <GameList games={counterGames} onBack={() => setSelectedCounter(null)} />
        ) : selectedChamp ? (
          <div>
            <button className="pp-back-btn" onClick={() => setSelectedChamp(null)}>← Back</button>
            <div className="pp-detail-header">
              <ChampIcon name={selectedChamp} size={48} />
              <div className="pp-detail-name">{selectedChamp}</div>
            </div>
            {countersByRole.map(({ role, counters }) => (
              <div key={role} className="pp-answers-section">
                <div className="pp-section-label">{selectedChamp} {role} — countered by</div>
                <div className="pp-answers-grid">
                  {counters.map(({ champ, count }) => (
                    <div key={champ} className="pp-answer-card pp-row-clickable" onClick={() => setSelectedCounter(champ)}>
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
          <div className="pp-list">
            {sortedBlinds.map(([champ, count], i) => (
              <div key={champ} className="pp-row pp-row-clickable" onClick={() => setSelectedChamp(champ)}>
                <span className="pp-rank">{i + 1}</span>
                <ChampIcon name={champ} size={36} />
                <span className="pp-name">{champ}</span>
                <span className="pp-count">{count}×</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
