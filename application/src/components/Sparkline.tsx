// Tiny SVG trend line for dashboard cards.
interface SparklineProps {
  data?: number[] | null;
  color?: string;
  w?: number;
  h?: number;
}

export default function Sparkline({ data, color = 'var(--accent)', w = 320, h = 46 }: SparklineProps) {
  if (!data || data.length < 2) return <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ display: 'block' }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const xx = (i: number) => (i / (data.length - 1)) * w;
  const yy = (v: number) => 4 + (h - 8) - ((v - min) / (max - min || 1)) * (h - 8);
  const d = data.map((v, i) => `${i ? 'L' : 'M'} ${xx(i).toFixed(1)} ${yy(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ display: 'block' }} preserveAspectRatio="none">
      <path d={d} stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
