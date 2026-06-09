import './env';
import express from 'express';
import cors from 'cors';
import esportsRouter from './routes/esports';
import leagueRouter from './routes/league';
import matchupsRouter from './routes/matchups';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://13.58.213.244'] }));
app.use(express.json());

app.use('/api/esports', esportsRouter);
app.use('/api/league', leagueRouter);
app.use('/api/matchups', matchupsRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
