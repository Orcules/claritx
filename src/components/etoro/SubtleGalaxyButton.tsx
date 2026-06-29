import * as React from "react";

import { cn } from "@/lib/utils";

type SubtleStar = {
  id: number;
  size: number;
  distance: number;
  duration: number;
  delay: number;
  alpha: number;
};

function generateSubtleStars(count: number): SubtleStar[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    size: 1.5 + Math.random() * 2,
    distance: 25 + Math.random() * 35,
    duration: 4 + Math.random() * 6,
    delay: Math.random() * 6,
    alpha: 0.4 + Math.random() * 0.5,
  }));
}

type SubtleGalaxyButtonProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  className?: string;
  starCount?: number;
};

export function SubtleGalaxyButton({
  className,
  children,
  starCount = 8,
  ...props
}: SubtleGalaxyButtonProps) {
  const stars = React.useMemo(() => generateSubtleStars(starCount), [starCount]);

  return (
    <a
      {...props}
      className={cn(
        "etoro-subtle-galaxy-btn group/btn relative overflow-hidden inline-flex items-center gap-2 rounded-lg",
        className
      )}
    >
      {/* Spark border effect */}
      <span className="etoro-subtle-galaxy-btn__spark" />

      {/* Galaxy ring with orbiting stars */}
      <span className="etoro-subtle-galaxy-btn__galaxy">
        <span className="etoro-subtle-galaxy-btn__ring">
          {stars.map((star) => (
            <span
              key={star.id}
              className="etoro-subtle-galaxy-btn__star"
              style={{
                "--size": star.size,
                "--distance": star.distance,
                "--duration": star.duration,
                "--delay": star.delay,
                "--alpha": star.alpha,
              } as React.CSSProperties}
            />
          ))}
        </span>
      </span>

      {/* Background */}
      <span className="etoro-subtle-galaxy-btn__bg" />

      {/* Content */}
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </a>
  );
}
