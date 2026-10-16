import { Star } from "lucide-react";

export function Stars({ value, size = "h-4 w-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${size} ${i <= Math.round(value) ? "fill-primary text-primary" : "text-muted-foreground/40"}`} />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          data-testid={`review-star-${i}`}
          aria-label={`${i}`}
          onClick={() => onChange(i)}
          className="rounded p-0.5 transition-transform hover:scale-110"
        >
          <Star className={`h-7 w-7 ${i <= value ? "fill-primary text-primary" : "text-muted-foreground/40"}`} />
        </button>
      ))}
    </div>
  );
}
