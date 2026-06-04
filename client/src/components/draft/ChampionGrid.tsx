import { useState, useMemo } from 'react';
import { ChampionData } from '../../types';

interface Props {
  champions: ChampionData[];
  usedChampions: Set<string>;
  onSelect: (id: string) => void;
  disabled: boolean;
  version: string;
}

const TAGS = ['All', 'Fighter', 'Tank', 'Mage', 'Assassin', 'Marksman', 'Support'];

export default function ChampionGrid({ champions, usedChampions, onSelect, disabled, version }: Props) {
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('All');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return champions.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
      const matchTag = tag === 'All' || c.tags.includes(tag);
      return matchSearch && matchTag;
    });
  }, [champions, search, tag]);

  return (
    <div className="champion-grid-container">
      <div className="grid-filters">
        <input
          type="text"
          placeholder="Search champion..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="grid-search"
          autoComplete="off"
        />
        <div className="tag-filters">
          {TAGS.map(t => (
            <button key={t} onClick={() => setTag(t)} className={`tag-btn ${tag === t ? 'active' : ''}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="champion-grid">
        {filtered.map(c => {
          const used = usedChampions.has(c.id);
          return (
            <button
              key={c.id}
              className={`champ-btn ${used ? 'used' : ''}`}
              onClick={() => !used && !disabled && onSelect(c.id)}
              title={c.name}
            >
              <img
                src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${c.id}.png`}
                alt={c.name}
                loading="lazy"
              />
              <span>{c.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
