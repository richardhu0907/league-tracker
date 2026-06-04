import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// StrictMode removed: it double-invokes useEffect in dev, which burns through
// Riot's dev key rate limit (100 req/2min) after ~4 searches.
createRoot(document.getElementById('root')!).render(<App />)
