import { useEffect } from 'react';
import DraftTab from './components/draft/DraftTab';
import EsportsTab from './components/EsportsTab';
import LeagueTab from './components/LeagueTab';
import { loadDDragonVersion } from './api/riot';
import { useState } from 'react';
import './App.css';
import './Draft.css';

type Tab = 'draft' | 'esports' | 'league';

function App() {
  const [tab, setTab] = useState<Tab>('draft');

  useEffect(() => { loadDDragonVersion(); }, []);

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">🐍 SnakeDraft</h1>
      </header>

      <nav className="tabs">
        <button className={`tab-btn ${tab === 'draft' ? 'active' : ''}`} onClick={() => setTab('draft')}>
          Draft
        </button>
        <button className={`tab-btn ${tab === 'esports' ? 'active' : ''}`} onClick={() => setTab('esports')}>
          Pro
        </button>
        <button className={`tab-btn ${tab === 'league' ? 'active' : ''}`} onClick={() => setTab('league')}>
          Leagues
        </button>
      </nav>

      <main className="main">
        {tab === 'draft' && <DraftTab />}
        {tab === 'esports' && <EsportsTab />}
        {tab === 'league' && <LeagueTab />}
      </main>
    </div>
  );
}

export default App;
