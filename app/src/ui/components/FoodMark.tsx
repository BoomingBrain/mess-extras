/** The veg / non-veg mark printed on Indian food: a square with a dot (veg) or a triangle (non-veg). */
export function FoodMark({ veg, size = 16 }: { veg: boolean; size?: number }) {
  const color = veg ? '#1E6B47' : '#7A3B12';
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" role="img" aria-label={veg ? 'Veg' : 'Non-veg'} className="shrink-0">
      <rect x="1" y="1" width="14" height="14" rx="1.5" fill="#fff" stroke={color} strokeWidth="1.6" />
      {veg ? <circle cx="8" cy="8" r="3.6" fill={color} /> : <path d="M8 4.2 L12 11.4 H4 Z" fill={color} />}
    </svg>
  );
}

export const isVegItem = (name: string) => name !== 'Chicken';
