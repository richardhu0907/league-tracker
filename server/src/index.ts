import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import summonerRouter from './routes/summoner';
import matchesRouter from './routes/matches';
import esportsRouter from './routes/esports';
import leagueRouter from './routes/league';
import matchupsRouter from './routes/matchups';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/summoner', summonerRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/esports', esportsRouter);
app.use('/api/league', leagueRouter);
app.use('/api/matchups', matchupsRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
