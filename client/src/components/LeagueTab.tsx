import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { getDDragonVersion } from '../api/riot';

const BASE = 'http://localhost:3001/api/league';

interface Player {
  name: string; champion: string; lane: string; kda: string;
}
interface TeamData { name: string; won: boolean; players: Player[]; bans: string[]; }
interface Match { matchId: string; date: string; blue: TeamData; red: TeamData; }
interface Standing { name: string; w: number; l: number; }
interface ChampStat {
  rank: number; name: string;
  picks: number; bans: number;
  wins: number; losses: number; winPct: string;
  bluePicks: number; redPicks: number;
}
interface LeagueData {
  totalGames: number; matches: Match[]; standings: Standing[];
}
interface PlayerStat {
  name: string; team: string; role: string;
  wins: number; losses: number; rating: number;
  kg: number; dg: number; ag: number; kdag: number; csg: number;
}

type LeagueView = 'standings' | 'matches' | 'champions' | 'players';

function ChampIcon({ name, size = 28 }: { name: string; size?: number }) {
  const v = getDDragonVersion();
  if (!name) return <div style={{ width: size, height: size, background: 'var(--surface2)', borderRadius: 4 }} />;
  return (
    <img
      // strip spaces/apostrophes/dots so name matches DDragon file naming, e.g. "Bel'Veth" → "BelVeth"
      src={`https://ddragon.leagueoflegends.com/cdn/${v}/img/champion/${name.replace(/[\s'\.]/g, '')}.png`}
      alt={name}
      style={{ width: size, height: size, borderRadius: 4, objectFit: 'cover' }}
      onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
    />
  );
}

function MatchCard({ match }: { match: Match }) {
  const [expanded, setExpanded] = useState(false);
  const { blue, red } = match;

  return (
    <div className="lg-match-card" onClick={() => setExpanded(e => !e)}>
      <div className="lg-match-header">
        <div className="lg-match-date">{match.date.split(' ').slice(0, 2).join(' ')}</div>

        <div className="lg-match-teams-row">
          <span className={`lg-team-label ${blue.won ? 'win' : 'lose'}`}>{blue.name}</span>
          <div className="lg-vs-score">
            <span className={blue.won ? 'lg-score-w' : 'lg-score-l'}>{blue.won ? 'W' : 'L'}</span>
            <span className="lg-vs">vs</span>
            <span className={red.won ? 'lg-score-w' : 'lg-score-l'}>{red.won ? 'W' : 'L'}</span>
          </div>
          <span className={`lg-team-label right ${red.won ? 'win' : 'lose'}`}>{red.name}</span>
        </div>

        <div className="lg-match-id">{match.matchId}</div>
        <span className="lg-expand-icon">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="lg-match-detail">
          {[{ team: blue, side: 'Blue' }, { team: red, side: 'Red' }].map(({ team, side }) => (
            <div key={side} className={`lg-detail-team ${side.toLowerCase()}`}>
              <div className="lg-detail-header">
                <span className={`lg-side-badge ${side.toLowerCase()}`}>{side}</span>
                <span className="lg-detail-team-name">{team.name}</span>
                <span className={team.won ? 'lg-result-win' : 'lg-result-loss'}>{team.won ? 'Victory' : 'Defeat'}</span>
              </div>
              <div className="lg-players">
                {team.players.map((p, i) => (
                  <div key={i} className="lg-player-row">
                    <ChampIcon name={p.champion} size={36} />
                    <div className="lg-player-info">
                      <span className="lg-player-champ">{p.champion}</span>
                      <span className="lg-player-name">{p.name}</span>
                    </div>
                    <span className="lg-player-lane">{p.lane}</span>
                    <span className="lg-player-kda">{p.kda}</span>
                  </div>
                ))}
              </div>
              <div className="lg-bans-detail">
                <span className="lg-bans-label">Bans:</span>
                {team.bans.map((b, i) => (
                  <span key={i} className="lg-ban-chip">
                    <ChampIcon name={b} size={20} />
                    <span>{b}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LeagueTab() {
  const [data, setData] = useState<LeagueData | null>(null);
  const [champStats, setChampStats] = useState<ChampStat[]>([]);
  const [players, setPlayers] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<LeagueView>('standings');
  const [champSearch, setChampSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('All');
  const [playerSearch, setPlayerSearch] = useState('');
  const [playerTeam, setPlayerTeam] = useState('All');
  const [playerRole, setPlayerRole] = useState('All');

  useEffect(() => {
    Promise.all([
      axios.get<LeagueData>(`${BASE}/overview`),
      axios.get<ChampStat[]>(`${BASE}/champstats`),
      axios.get<PlayerStat[]>(`${BASE}/players`),
    ])
      .then(([overviewRes, champRes, playersRes]) => {
        setData(overviewRes.data);
        setChampStats(champRes.data);
        setPlayers(playersRes.data);
      })
      .catch(() => setError('Failed to load league data'))
      .finally(() => setLoading(false));
  }, []);

  const teams = useMemo(() => data ? ['All', ...data.standings.map(s => s.name)] : ['All'], [data]);

  const filteredMatches = useMemo(() => {
    if (!data) return [];
    if (teamFilter === 'All') return data.matches;
    return data.matches.filter(m => m.blue.name === teamFilter || m.red.name === teamFilter);
  }, [data, teamFilter]);

  const filteredChamps = useMemo(() => {
    if (!champSearch) return champStats;
    return champStats.filter(c => c.name.toLowerCase().includes(champSearch.toLowerCase()));
  }, [champStats, champSearch]);

  const ROLES = ['All', 'Top', 'Jungle', 'Mid', 'Bot', 'Support'];

  const filteredPlayers = useMemo(() => {
    return players
      .filter(p =>
        (playerTeam === 'All' || p.team === playerTeam) &&
        (playerRole === 'All' || p.role === playerRole) &&
        (!playerSearch || p.name.toLowerCase().includes(playerSearch.toLowerCase()))
      )
      .sort((a, b) => b.rating - a.rating);
  }, [players, playerTeam, playerRole, playerSearch]);

  if (loading) return <div className="loading">Loading league data...</div>;
  if (error) return <div className="error-msg">{error}</div>;
  if (!data) return null;

  return (
    <div className="league-container">
      <div className="league-header">
        <div className="league-title">
          <h2 className="lg-title">Aegis League</h2>
          <span className="lg-subtitle">{data.totalGames} games · Spring 2026</span>
        </div>
        <div className="league-view-tabs">
          {(['standings', 'matches', 'champions', 'players'] as LeagueView[]).map(v => (
            <button key={v} className={`lg-view-tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
              {v === 'standings' ? 'Standings' : v === 'matches' ? 'Match History' : v === 'champions' ? 'Champion Stats' : 'Players'}
            </button>
          ))}
        </div>
      </div>

      {view === 'standings' && (
        <div className="lg-standings-view">
          <div className="lg-standings-table">
            <div className="lg-standings-head">
              <span>#</span><span>Team</span><span>W</span><span>L</span><span>Win%</span><span>GP</span>
            </div>
            {data.standings.map((t, i) => {
              const gp = t.w + t.l;
              const wr = gp > 0 ? Math.round(t.w / gp * 100) : 0;
              return (
                <div key={t.name} className={`lg-standings-row ${i < 4 ? 'playoff' : ''}`}
                  onClick={() => { setTeamFilter(t.name); setView('matches'); }}>
                  <span className="lg-standing-rank">{i + 1}</span>
                  <span className="lg-standing-name">{t.name}</span>
                  <span className="lg-standing-w">{t.w}</span>
                  <span className="lg-standing-l">{t.l}</span>
                  <span className="lg-standing-wr">{wr}%</span>
                  <span className="lg-standing-gp">{gp}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'matches' && (
        <div className="lg-matches-view">
          <div className="lg-matches-controls">
            <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} className="region-select">
              {teams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="result-count">{filteredMatches.length} matches</span>
          </div>
          <div className="lg-matches-list">
            {filteredMatches.map(m => <MatchCard key={m.matchId} match={m} />)}
          </div>
        </div>
      )}

      {view === 'champions' && (
        <div className="lg-champs-view">
          <div className="champ-stats-header">
            <input type="text" placeholder="Search champion..." value={champSearch}
              onChange={e => setChampSearch(e.target.value)} className="grid-search stats-search" />
            <span className="result-count">{filteredChamps.length} champions</span>
          </div>
          <div className="champ-stats-table-wrap">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Champion</th>
                  <th>Presence</th>
                  <th>Picks</th>
                  <th>Win%</th>
                  <th>Bans</th>
                  <th title="Blue side picks">🔵P</th>
                  <th title="Red side picks">🔴P</th>
                </tr>
              </thead>
              <tbody>
                {filteredChamps.map((c) => {
                  const wr = parseFloat(c.winPct);
                  const presencePct = data.totalGames > 0
                    ? ((c.picks + c.bans) / data.totalGames * 100).toFixed(1) + '%'
                    : '—';
                  return (
                    <tr key={c.name}>
                      <td className="rank-num">{c.rank}</td>
                      <td>
                        <div className="champ-cell">
                          {/* strip spaces/apostrophes/dots to match DDragon file naming */}
                          <ChampIcon name={c.name.replace(/[\s'.]/g, '')} size={36} />
                          <span className="champ-cell-name">{c.name}</span>
                        </div>
                      </td>
                      <td className="stat-cell" style={{ color: (c.picks + c.bans) / data.totalGames >= 0.5 ? '#facc15' : 'var(--text)' }}>
                        {presencePct}
                      </td>
                      <td className="stat-cell">{c.picks}</td>
                      <td className={`stat-cell ${c.picks > 0 ? (wr >= 50 ? 'positive' : 'negative') : ''}`}>
                        {c.picks > 0 ? c.winPct : '—'}
                      </td>
                      <td className="stat-cell">{c.bans}</td>
                      <td className="stat-cell">{c.bluePicks}</td>
                      <td className="stat-cell">{c.redPicks}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'players' && (
        <div className="lg-players-view">
          <div className="lg-players-filters">
            <input
              type="text"
              placeholder="Search player..."
              value={playerSearch}
              onChange={e => setPlayerSearch(e.target.value)}
              className="grid-search"
              style={{ width: 180 }}
            />
            <select value={playerTeam} onChange={e => setPlayerTeam(e.target.value)} className="region-select">
              {['All', ...Array.from(new Set(players.map(p => p.team))).sort()].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div className="tag-filters">
              {ROLES.map(r => (
                <button key={r} onClick={() => setPlayerRole(r)} className={`tag-btn ${playerRole === r ? 'active' : ''}`}>
                  {r}
                </button>
              ))}
            </div>
            <span className="result-count">{filteredPlayers.length} players</span>
          </div>

          <div className="champ-stats-table-wrap">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>Team</th>
                  <th>Role</th>
                  <th>W-L</th>
                  <th>Rating</th>
                  <th>K/g</th>
                  <th>D/g</th>
                  <th>A/g</th>
                  <th>KDA/g</th>
                  <th>CS/g</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((p, i) => (
                  <tr key={p.name}>
                    <td className="rank-num">{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>
                      {p.name.split('#')[0]}
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>#{p.name.split('#')[1]}</span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{p.team}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{p.role}</td>
                    <td className="stat-cell">{p.wins}-{p.losses}</td>
                    <td className="stat-cell" style={{ color: p.rating >= 50 ? 'var(--win)' : 'var(--text)' }}>{p.rating.toFixed(2)}</td>
                    <td className="stat-cell">{p.kg.toFixed(1)}</td>
                    <td className="stat-cell">{p.dg.toFixed(1)}</td>
                    <td className="stat-cell">{p.ag.toFixed(1)}</td>
                    <td className="stat-cell">{p.kdag.toFixed(2)}</td>
                    <td className="stat-cell">{p.csg.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
