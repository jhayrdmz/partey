import { Search, X } from "lucide-react";
import { GAME_CATEGORIES, type GameCategory } from "@shared/games";
import { CATEGORY_LABELS } from "@/features/games/registry";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/cn";

/** Longest search text (no game name comes close). */
const SEARCH_MAX = 40;

export function CategoryFilter({
  category,
  onCategory,
  search,
  onSearch,
}: {
  category: GameCategory | "all";
  onCategory: (c: GameCategory | "all") => void;
  search: string;
  onSearch: (s: string) => void;
}) {
  const chips: (GameCategory | "all")[] = ["all", ...GAME_CATEGORIES];
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Search games"
          placeholder="Search games"
          value={search}
          maxLength={SEARCH_MAX}
          onChange={(e) => onSearch(e.target.value.slice(0, SEARCH_MAX))}
          className="h-12 pl-12 text-base"
        />
        {search && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onSearch("")}
            className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Game categories">
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={category === c}
            onClick={() => onCategory(c)}
            className={cn(
              "min-h-10 shrink-0 rounded-md border px-4 text-sm font-bold transition",
              category === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground",
            )}
          >
            {c === "all" ? "All games" : CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>
    </div>
  );
}
