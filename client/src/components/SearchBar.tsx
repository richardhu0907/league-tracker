import { useState, FormEvent } from 'react';

interface Props {
  onSearch: (platform: string, gameName: string, tagLine: string) => void;
  loading: boolean;
}

const PLATFORMS = [
  { value: 'na1', label: 'NA' },
  { value: 'euw1', label: 'EUW' },
  { value: 'eun1', label: 'EUNE' },
  { value: 'kr', label: 'KR' },
  { value: 'br1', label: 'BR' },
  { value: 'jp1', label: 'JP' },
  { value: 'la1', label: 'LAN' },
  { value: 'la2', label: 'LAS' },
  { value: 'oc1', label: 'OCE' },
  { value: 'tr1', label: 'TR' },
  { value: 'ru', label: 'RU' },
];

export default function SearchBar({ onSearch, loading }: Props) {
  const [input, setInput] = useState('');
  const [platform, setPlatform] = useState('na1');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const hashIndex = input.lastIndexOf('#');
    if (hashIndex === -1) return;
    const gameName = input.slice(0, hashIndex).trim();
    const tagLine = input.slice(hashIndex + 1).trim();
    if (!gameName || !tagLine) return;
    onSearch(platform, gameName, tagLine);
  };

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <select
        value={platform}
        onChange={e => setPlatform(e.target.value)}
        className="region-select"
      >
        {PLATFORMS.map(p => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="PlayerName#TAG"
        className="search-input"
      />
      <button type="submit" disabled={loading} className="search-btn">
        {loading ? '...' : 'Search'}
      </button>
    </form>
  );
}
