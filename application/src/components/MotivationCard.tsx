import Icon from './Icon.jsx';
import { ChangeText } from './ui.jsx';
import { getMessage } from '../lib/motivation.js';
import { formatChange } from '../lib/format.js';

interface MotivationCardProps {
  person: { name: string };
  state: string;
  milestone5?: number;
  milestone10?: number;
  progress?: number;
}

// Per-person, self-anchored motivation (REQUIREMENTS §6.4).
export default function MotivationCard({ person, state, milestone5 = 0, milestone10 = 0, progress = 0 }: MotivationCardProps) {
  const m = getMessage(state, { milestone5 });
  return (
    <div className="card" style={{ background: 'linear-gradient(160deg,#effaf8,#ffffff)' }}>
      <div className="row between" style={{ marginBottom: 4 }}>
        <span className="card-title">For {person.name}</span>
        <span className="pill">{m.label}</span>
      </div>
      <div className="motiv">
        <span className="emoji">{m.emoji}</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{m.title}</div>
          <p className="t2 small" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>{m.body}</p>
        </div>
      </div>
      <div className="milestone-track" style={{ marginTop: 14 }}>
        <div className={'milestone' + (progress >= 0.5 ? ' done' : '')}>
          <span className="dot">{progress >= 0.5 ? <Icon name="check" size={14} color="#fff" /> : '5%'}</span>
          <span className="ml">5% · <ChangeText change={formatChange(-milestone5)} /></span>
        </div>
        <div className="milestone-bar" style={{ background: `linear-gradient(90deg,var(--accent) ${progress * 100}%,var(--track) ${progress * 100}%)` }} />
        <div className={'milestone' + (progress >= 1 ? ' done' : '')}>
          <span className="dot">{progress >= 1 ? <Icon name="check" size={14} color="#fff" /> : '10%'}</span>
          <span className="ml">10% · <ChangeText change={formatChange(-milestone10)} /></span>
        </div>
      </div>
      <p className="muted small" style={{ margin: '10px 0 0' }}>Next milestone: {progress < 0.5 ? '5%' : '10%'} of body weight</p>
    </div>
  );
}
