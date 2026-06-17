import { useState, useEffect } from 'react';
import axios from 'axios';
import { getDDragonVersion } from '../api/riot';
import ProMatchesTab, { PrioPicksTab, CounterPicksTab, CombosTab } from './ProMatchesTab';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/esports`;

interface League { id: string; slug: string; name: string; region: string; image: string; }
interface MatchTeam { name: string; code: string; image: string; wins?: number; won?: boolean; }
interface EsportsMatch { id: string; startTime: string; blockName: string; format: number; teams: [MatchTeam, MatchTeam]; }
interface StandingsTeam { name: string; code: string; image: string; w: number; l: number; }
interface ResultsData { matches: EsportsMatch[]; standings: StandingsTeam[]; tournament?: { name: string }; }
interface ChampStat { name: string; id: string; picks: number; bans: number; prioScore: string; wins: number; losses: number; winRate: string; }
interface ChampStatsData { season: string; split: string; data: ChampStat[]; }


function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function MatchRow({ match, completed }: { match: EsportsMatch; completed: boolean }) {
  const [t1, t2] = match.teams;
  return (
    <div className="es-match-row">
      <div className="es-match-meta">
        <span className="es-date">{formatDate(match.startTime)}</span>
        <span className="es-block">{match.blockName}</span>
      </div>
      <div className="es-match-teams">
        <div className={`es-team ${completed ? (t1.won ? 'winner' : 'loser') : ''}`}>
          <img src={t1.image} alt={t1.code} className="es-logo" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span className="es-code">{t1.code}</span>
          {completed && <span className="es-score">{t1.wins}</span>}
        </div>
        <span className="es-vs">{completed ? 'vs' : formatTime(match.startTime)}</span>
        <div className={`es-team right ${completed ? (t2.won ? 'winner' : 'loser') : ''}`}>
          {completed && <span className="es-score">{t2.wins}</span>}
          <span className="es-code">{t2.code}</span>
          <img src={t2.image} alt={t2.code} className="es-logo" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
      </div>
      <span className="es-format">BO{match.format}</span>
    </div>
  );
}

function Standings({ teams }: { teams: StandingsTeam[] }) {
  return (
    <div className="es-standings">
      <div className="es-standings-header">
        <span>#</span><span>Team</span><span>W</span><span>L</span><span>WR</span>
      </div>
      {teams.map((t, i) => {
        const total = t.w + t.l;
        const wr = total > 0 ? Math.round((t.w / total) * 100) : 0;
        return (
          <div key={t.code} className={`es-standing-row ${i < 4 ? 'top-cut' : ''}`}>
            <span className="es-standing-rank">{i + 1}</span>
            <div className="es-standing-team">
              <img src={t.image} alt={t.code} className="es-standing-logo" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <span>{t.code}</span>
            </div>
            <span className="es-standing-w">{t.w}</span>
            <span className="es-standing-l">{t.l}</span>
            <span className="es-standing-wr">{total > 0 ? `${wr}%` : '—'}</span>
          </div>
        );
      })}
    </div>
  );
}

function ChampionStatsView({ leagueId }: { leagueId: string }) {
  const [data, setData] = useState<ChampStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const v = getDDragonVersion();

  useEffect(() => {
    setLoading(true);
    setData(null);
    setError('');
    axios.get<ChampStatsData>(`${BASE}/champstats/${leagueId}`)
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load champion stats'))
      .finally(() => setLoading(false));
  }, [leagueId]);

  if (loading) return <div className="loading">Loading champion stats...</div>;
  if (error) return <div className="error-msg">{error}</div>;
  if (!data || data.data.length === 0) return <div className="loading">No champion data found.</div>;

  const filtered = data.data.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="champ-stats-container">
      <div className="champ-stats-header">
        <input
          type="text"
          placeholder="Search champion..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="grid-search"
          style={{ width: 200 }}
        />
        <span className="es-tournament-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Season {data.season} · {data.split} · All Regions
        </span>
      </div>

      <div className="champ-stats-table-wrap">
        <table className="stats-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Champion</th>
              <th>Picks</th>
              <th>Bans</th>
              <th>Prio Score</th>
              <th>Wins</th>
              <th>Losses</th>
              <th>Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const wr = parseFloat(c.winRate);
              return (
                <tr key={c.id}>
                  <td className="rank-num">{i + 1}</td>
                  <td>
                    <div className="champ-cell">
                      <img
                        src={`https://ddragon.leagueoflegends.com/cdn/${v}/img/champion/${c.id}.png`}
                        alt={c.name}
                        className="champ-cell-icon"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <span className="champ-cell-name">{c.name}</span>
                    </div>
                  </td>
                  <td className="stat-cell">{c.picks}</td>
                  <td className="stat-cell">{c.bans}</td>
                  <td className="stat-cell">{c.prioScore}</td>
                  <td className="stat-cell">{c.wins}</td>
                  <td className="stat-cell">{c.losses}</td>
                  <td className="stat-cell" style={{ color: wr >= 50 ? 'var(--win)' : 'var(--loss)' }}>
                    {c.winRate}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type EsportsView = 'results' | 'champstats' | 'drafts' | 'priopicks' | 'counterpicks' | 'combos';

export default function EsportsTab() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selected, setSelected] = useState<League | null>(null);
  const [results, setResults] = useState<ResultsData | null>(null);
  const [upcoming, setUpcoming] = useState<EsportsMatch[]>([]);
  const [view, setView] = useState<EsportsView>('results');
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get<League[]>(`${BASE}/leagues`)
      .then(res => { setLeagues(res.data); if (res.data.length > 0) setSelected(res.data[0]); })
      .catch(() => setError('Failed to load leagues'))
      .finally(() => setLoadingLeagues(false));
  }, []);

  useEffect(() => {
    if (!selected || view !== 'results') return;
    setLoadingContent(true);
    setResults(null);
    setUpcoming([]);
    Promise.all([
      axios.get<ResultsData>(`${BASE}/results/${selected.id}`),
      axios.get<EsportsMatch[]>(`${BASE}/upcoming/${selected.id}`),
    ])
      .then(([rRes, uRes]) => { setResults(rRes.data); setUpcoming(uRes.data); })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoadingContent(false));
  }, [selected, view]);

  if (loadingLeagues) return <div className="loading">Loading leagues...</div>;
  if (error) return <div className="error-msg">{error}</div>;

  return (
    <div className="esports-container">
      {/* Sub-tab toggle */}
      <div className="es-view-tabs">
        <button className={`es-view-tab ${view === 'results' ? 'active' : ''}`} onClick={() => setView('results')}>
          Results & Standings
        </button>
        <button className={`es-view-tab ${view === 'champstats' ? 'active' : ''}`} onClick={() => setView('champstats')}>
          Champion Stats
        </button>
        <button className={`es-view-tab ${view === 'drafts' ? 'active' : ''}`} onClick={() => setView('drafts')}>
          Drafts
        </button>
        <button className={`es-view-tab ${view === 'priopicks' ? 'active' : ''}`} onClick={() => setView('priopicks')}>
          Prio Picks
        </button>
        <button className={`es-view-tab ${view === 'counterpicks' ? 'active' : ''}`} onClick={() => setView('counterpicks')}>
          Counter Picks
        </button>
        <button className={`es-view-tab ${view === 'combos' ? 'active' : ''}`} onClick={() => setView('combos')}>
          Combos
        </button>
      </div>

      {/* League selector — only relevant for Results & Standings */}
      {view === 'results' && (
        <div className="es-league-bar">
          {leagues.map(l => (
            <button key={l.id} onClick={() => setSelected(l)}
              className={`es-league-btn ${selected?.id === l.id ? 'active' : ''}`} title={l.name}>
              <img src={l.image} alt={l.name} className="es-league-img" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <span>{l.name}</span>
            </button>
          ))}
        </div>
      )}

      {view === 'combos' ? (
        <CombosTab />
      ) : view === 'counterpicks' ? (
        <CounterPicksTab />
      ) : view === 'priopicks' ? (
        <PrioPicksTab />
      ) : view === 'drafts' ? (
        <ProMatchesTab />
      ) : view === 'champstats' && selected ? (
        <ChampionStatsView leagueId={selected.id} />
      ) : loadingContent ? (
        <div className="loading">Loading {selected?.name} data...</div>
      ) : (
        <div className="esports-body">
          <div className="esports-main">
            {upcoming.length > 0 && (
              <section className="es-section">
                <h3 className="es-section-title">Upcoming</h3>
                {upcoming.map(m => <MatchRow key={m.id} match={m} completed={false} />)}
              </section>
            )}
            <section className="es-section">
              <h3 className="es-section-title">
                Results
                {results?.tournament && <span className="es-tournament-label">{results.tournament.name}</span>}
              </h3>
              {!results?.matches.length
                ? <div className="loading">No results found</div>
                : results.matches.slice(0, 20).map(m => <MatchRow key={m.id} match={m} completed />)
              }
            </section>
          </div>
          {!!results?.standings.length && (
            <div className="esports-sidebar">
              <h3 className="es-section-title">Standings</h3>
              <Standings teams={results.standings} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
