import { Link } from "@tanstack/react-router";
import { Sparkles, Compass, BookmarkCheck } from "lucide-react";

export type AppTab = "today" | "discover";

export function AppNav({
  active,
  onChange,
}: {
  active: AppTab;
  onChange: (tab: AppTab) => void;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition";
  const activeCls = "bg-primary text-primary-foreground shadow-sm";
  const inactiveCls = "text-foreground hover:bg-muted";
  return (
    <nav className="sticky top-0 z-30 -mx-6 mb-4 border-b border-border/60 bg-background/85 px-6 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange("today")}
            className={`${base} ${active === "today" ? activeCls : inactiveCls}`}
          >
            <Sparkles className="h-3.5 w-3.5" /> Today
          </button>
          <button
            type="button"
            onClick={() => onChange("discover")}
            className={`${base} ${active === "discover" ? activeCls : inactiveCls}`}
          >
            <Compass className="h-3.5 w-3.5" /> Discover
          </button>
        </div>
        <Link
          to="/saved"
          className={`${base} ${inactiveCls}`}
        >
          <BookmarkCheck className="h-3.5 w-3.5" /> Library
        </Link>
      </div>
    </nav>
  );
}
