import { useState, useEffect } from 'react';
import SearchBar from './components/SearchBar';
import MatchHistory from './components/MatchHistory';
import DraftTab from './components/draft/DraftTab';
import EsportsTab from './components/EsportsTab';
import LeagueTab from './components/LeagueTab';
import { Summoner } from './types';
import { searchSummoner, loadDDragonVersion, getDDragonVersion } from './api/riot';
import './App.css';
import './Draft.css';

type Tab = 'history' | 'draft' | 'esports' | 'league';

function App() {
  const [tab, setTab] = useState<Tab>('history');
  const [summoner, setSummoner] = useState<Summoner | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadDDragonVersion(); }, []);

  const handleSearch = async (platform: string, gameName: string, tagLine: string) => {
    setLoading(true);
    setError('');
    setSummoner(null);
    try {
      const data = await searchSummoner(platform, gameName, tagLine);
      setSummoner(data);
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Summoner not found');
    } finally {
      setLoading(false);
    }
  };

  const v = getDDragonVersion();

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">LoL Tracker</h1>
        {tab === 'history' && <SearchBar onSearch={handleSearch} loading={loading} />}
      </header>

      <nav className="tabs">
        <button className={`tab-btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          Match History
        </button>
        <button className={`tab-btn ${tab === 'draft' ? 'active' : ''}`} onClick={() => setTab('draft')}>
          Draft
        </button>
        <button className={`tab-btn ${tab === 'esports' ? 'active' : ''}`} onClick={() => setTab('esports')}>
          Pro Scene
        </button>
        <button className={`tab-btn ${tab === 'league' ? 'active' : ''}`} onClick={() => setTab('league')}>
          Aegis
        </button>
      </nav>

      <main className="main">
        {tab === 'history' && (
          <>
            {error && <div className="error-msg">{error}</div>}
            {summoner && (
              <>
                <div className="summoner-card">
                  <img
                    src={`https://ddragon.leagueoflegends.com/cdn/${v}/img/profileicon/${summoner.profileIconId}.png`}
                    alt="Profile Icon"
                    className="profile-icon"
                  />
                  <div className="summoner-info">
                    <h2>
                      {summoner.gameName}
                      <span className="tag">#{summoner.tagLine}</span>
                    </h2>
                    <p>Level {summoner.summonerLevel}</p>
                  </div>
                </div>
                <MatchHistory puuid={summoner.puuid} region={summoner.region} />
              </>
            )}
            {!summoner && !loading && !error && (
              <div className="placeholder">Search for a summoner to see their match history</div>
            )}
          </>
        )}

        {tab === 'draft' && <DraftTab />}
        {tab === 'esports' && <EsportsTab />}
        {tab === 'league' && <LeagueTab />}
      </main>
    </div>
  );
}

export default App;
