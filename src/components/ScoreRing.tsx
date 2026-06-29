import { useEffect, useState } from "react";

interface ScoreRingProps {
  score: number;
  size?: number;
  onColoredBg?: boolean;
}

export function ScoreRing({ score, size = 80, onColoredBg = false }: ScoreRingProps) {
  const [drawn, setDrawn] = useState(0);
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = (score / 100) * circumference;

  // Animate fill from 0 → target on mount / score change
  useEffect(() => {
    setDrawn(0);
    const id = requestAnimationFrame(() => {
      setDrawn(target);
    });
    return () => cancelAnimationFrame(id);
  }, [target]);

  const themeColor = score >= 70 ? "hsl(var(--success))" : score >= 40 ? "hsl(var(--warning))" : "hsl(var(--destructive))";
  const trackStroke = onColoredBg ? "rgba(255,255,255,0.25)" : "hsl(var(--muted))";
  const progressStroke = onColoredBg ? "rgba(255,255,255,0.95)" : themeColor;
  const textColor = onColoredBg ? "#ffffff" : themeColor;
  const backdropFill = onColoredBg ? "rgba(0,0,0,0.18)" : "transparent";

  return (
    <div className="relative animate-fade-in" style={{ width: size, height: size, animationDuration: "400ms" }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill={backdropFill} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackStroke}
          strokeWidth="4"
          fill="none"
          opacity={onColoredBg ? 1 : 0.3}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progressStroke}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - drawn}
          style={{
            transition: "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)",
            filter: onColoredBg ? "none" : `drop-shadow(0 0 6px ${themeColor})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold font-display" style={{ color: textColor }}>
          {(score / 10).toFixed(1)}
        </span>
      </div>
    </div>
  );
}
