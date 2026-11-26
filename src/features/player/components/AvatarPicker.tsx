import { AVATARS } from "@shared/avatars";
import { cn } from "@/utils/cn";

export function AvatarPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Choose an avatar" className="grid grid-cols-4 gap-2 xs:gap-3 sm:grid-cols-8">
      {AVATARS.map((a) => {
        const selected = a.id === value;
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={a.label}
            onClick={() => onChange(a.id)}
            className={cn(
              "relative grid aspect-square min-h-12 place-items-center rounded-2xl text-3xl transition-all outline-none",
              "focus-visible:ring-4 focus-visible:ring-ring/50 active:scale-90",
              selected ? "scale-105 ring-4 ring-primary" : "opacity-80 hover:opacity-100",
            )}
            style={{ background: a.color }}
          >
            <span className="drop-shadow">{a.emoji}</span>
          </button>
        );
      })}
    </div>
  );
}
