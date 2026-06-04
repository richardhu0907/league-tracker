import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { getDDragonVersion } from '../api/riot';

interface ChampionStat {
  id: string;
  name: string;
  role: string;
  winRate: number;
  pickRate: number;
  banRate: number;
}

interface ApiResponse {
  patch: string;
  data: ChampionStat[];
}

type SortKey = 'winRate' | 'pickRate' | 'banRate';

const ROLE_LABELS: Record<string, string> = {
  TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid', BOTTOM: 'Bot', UTILITY: 'Support',
};

const ROLE_FILTERS = ['All', 'TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];

function getTier(wr: number): { label: string; cls: string } {
  if (wr >= 0.525) return { label: 'S', cls: 'tier-s' };
  if (wr >= 0.510) return { label: 'A', cls: 'tier-a' };
  if (wr >= 0.495) return { label: 'B', cls: 'tier-b' };
  if (wr >= 0.480) return { label: 'C', cls: 'tier-c' };
  return { label: 'D', cls: 'tier-d' };
}

function SortIcon({ active, desc }: { active: boolean; desc: boolean }) {
  if (!active) return <span className="sort-icon inactive">↕</span>;
  return <span className="sort-icon">{desc ? '↓' : '↑'}</span>;
}

export default function StatsTab() {
  const [raw, setRaw] = useState<ChampionStat[]>([]);
  const [patch, setPatch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('All');
  const [sortKey, setSortKey] = useState<SortKey>('winRate');
  const [sortDesc, setSortDesc] = useState(true);

  const v = getDDragonVersion();

  useEffect(() => {
    axios.get<ApiResponse>('http://localhost:3001/api/stats/tier-list')
      .then(res => {
        setRaw(res.data.data);
        setPatch(res.data.patch ?? '');
      })
      .catch(() => setError('Failed to load champion stats. Make sure the server is running.'))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    let list = raw;
    if (role !== 'All') list = list.filter(c => c.role === role);
    if (search) list = list.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    return [...list].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey];
      return sortDesc ? -diff : diff;
    });
  }, [raw, role, search, sortKey, sortDesc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(d => !d);
    else { setSortKey(key); setSortDesc(true); }
  };

  if (loading) return <div className="loading">Loading champion stats...</div>;
  if (error) return <div className="error-msg">{error}</div>;

  return (
    <div className="stats-container">
      <div className="stats-header">
        <div className="stats-filters">
          <input
            type="text"
            placeholder="Search champion..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="grid-search stats-search"
          />
          <div className="tag-filters">
            {ROLE_FILTERS.map(r => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`tag-btn ${role === r ? 'active' : ''}`}
              >
                {r === 'All' ? 'All' : ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
        <div className="stats-meta">
          <span className="patch-label">{patch ? `Patch ${patch}` : ''}</span>
          <span className="result-count">{rows.length} champions</span>
        </div>
      </div>

      <div className="stats-table-wrapper">
        <table className="stats-table">
          <thead>
            <tr>
              <th className="col-rank">#</th>
              <th className="col-champ">Champion</th>
              <th className="col-role">Role</th>
              <th className="col-tier">Tier</th>
              <th className="col-stat sortable" onClick={() => handleSort('winRate')}>
                Win Rate <SortIcon active={sortKey === 'winRate'} desc={sortDesc} />
              </th>
              <th className="col-stat sortable" onClick={() => handleSort('pickRate')}>
                Pick Rate <SortIcon active={sortKey === 'pickRate'} desc={sortDesc} />
              </th>
              <th className="col-stat sortable" onClick={() => handleSort('banRate')}>
                Ban Rate <SortIcon active={sortKey === 'banRate'} desc={sortDesc} />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => {
              const tier = getTier(c.winRate);
              return (
                <tr key={`${c.id}-${c.role}`}>
                  <td className="col-rank rank-num">{i + 1}</td>
                  <td>
                    <div className="champ-cell">
                      <img
                        src={`https://ddragon.leagueoflegends.com/cdn/${v}/img/champion/${c.id}.png`}
                        alt={c.name}
                        className="champ-cell-icon"
                      />
                      <span className="champ-cell-name">{c.name}</span>
                    </div>
                  </td>
                  <td className="role-cell">{ROLE_LABELS[c.role] ?? c.role}</td>
                  <td><span className={`tier-badge ${tier.cls}`}>{tier.label}</span></td>
                  <td className={`stat-cell ${c.winRate >= 0.5 ? 'positive' : 'negative'}`}>
                    {(c.winRate * 100).toFixed(1)}%
                  </td>
                  <td className="stat-cell">{(c.pickRate * 100).toFixed(2)}%</td>
                  <td className="stat-cell">{(c.banRate * 100).toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
