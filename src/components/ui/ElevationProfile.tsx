"use client";

interface ElevationProfileProps {
  data: number[];
  className?: string;
}

export default function ElevationProfile({ data, className = "" }: ElevationProfileProps) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 200;
  const h = 48;
  const pad = 4;

  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `${pad},${h - pad} ${points} ${w - pad},${h - pad}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`w-full ${className}`}
      preserveAspectRatio="none"
    >
      <polygon points={areaPoints} fill="var(--green)" fillOpacity="0.15" />
      <polyline points={points} fill="none" stroke="var(--green)" strokeWidth="1.5" />
    </svg>
  );
}
