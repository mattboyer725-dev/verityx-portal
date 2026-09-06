export function Spark({ values, className }: { values: number[]; className?: string }) {
  if (!values || values.length < 2) return null;
  const nums = values.filter((n) => Number.isFinite(n));
  if (nums.length < 2) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const w = 160;
  const h = 40;
  const pts = nums
    .map((v, i) => {
      const x = (i / (nums.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = nums[nums.length - 1] >= nums[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className || "spark"} aria-hidden="true" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={up ? "var(--color-green)" : "var(--color-red)"}
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
      />
    </svg>
  );
}
