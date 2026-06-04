import { Match, Participant } from '../types';
import { getDDragonVersion } from '../api/riot';

interface Props {
  match: Match;
  puuid: string;
}

const QUEUE_NAMES: Record<number, string> = {
  420: 'Ranked Solo',
  440: 'Ranked Flex',
  450: 'ARAM',
  400: 'Normal Draft',
  430: 'Normal Blind',
  700: 'Clash',
  0: 'Custom',
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function ItemIcon({ id }: { id: number }) {
  const v = getDDragonVersion();
  if (!id) return <div className="item-slot empty" />;
  return (
    <img
      className="item-slot"
      src={`https://ddragon.leagueoflegends.com/cdn/${v}/img/item/${id}.png`}
      alt=""
      onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
    />
  );
}

export default function MatchCard({ match, puuid }: Props) {
  const v = getDDragonVersion();
  const me: Participant | undefined = match.info.participants.find(p => p.puuid === puuid);
  if (!me) return null;

  const kda = me.deaths === 0 ? 'Perfect' : ((me.kills + me.assists) / me.deaths).toFixed(2);
  const cs = me.totalMinionsKilled + me.neutralMinionsKilled;
  const queue = QUEUE_NAMES[match.info.queueId] ?? match.info.gameMode;

  return (
    <div className={`match-card ${me.win ? 'win' : 'loss'}`}>
      <div>
        <div className="match-result">{me.win ? 'WIN' : 'LOSS'}</div>
        <div className="match-mode">{queue}</div>
        <div className="match-duration">{formatDuration(match.info.gameDuration)}</div>
      </div>

      <div className="champion-info">
        <img
          src={`https://ddragon.leagueoflegends.com/cdn/${v}/img/champion/${me.championName}.png`}
          alt={me.championName}
          className="champion-icon"
        />
        <span className="champion-name">{me.championName}</span>
        <span className="position">{me.teamPosition || '—'}</span>
      </div>

      <div className="kda">
        <div>
          <span className="kills">{me.kills}</span>
          <span className="sep"> / </span>
          <span className="deaths">{me.deaths}</span>
          <span className="sep"> / </span>
          <span className="assists">{me.assists}</span>
        </div>
        <div className="kda-ratio">{kda} KDA</div>
      </div>

      <div className="stats">
        <div>{cs} CS</div>
        <div>{(me.goldEarned / 1000).toFixed(1)}k gold</div>
      </div>

      <div className="items">
        {([me.item0, me.item1, me.item2, me.item3, me.item4, me.item5, me.item6]).map((id, i) => (
          <ItemIcon key={i} id={id} />
        ))}
      </div>
    </div>
  );
}
