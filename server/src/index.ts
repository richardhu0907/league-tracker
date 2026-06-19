import './env';
import express from 'express';
import cors from 'cors';
import esportsRouter from './routes/esports';
import leagueRouter from './routes/league';
import matchupsRouter from './routes/matchups';
import promatchesRouter from './routes/promatches';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://18.223.23.152', 'https://snakedraft.win', 'https://www.snakedraft.win'] }));
app.use(express.json());

app.use('/api/esports', esportsRouter);
app.use('/api/league', leagueRouter);
app.use('/api/matchups', matchupsRouter);
app.use('/api/promatches', promatchesRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
