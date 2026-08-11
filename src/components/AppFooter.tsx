import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/BrandLogo";

export function AppFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground sm:flex-row">
        <span className="flex items-center gap-2">
          <BrandLogo iconOnly markClassName="h-5 w-5" gradientId="nf-footer" />
          © 2026 NativeFlow — understand content in context.
        </span>
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link to="/library" className="hover:text-foreground">
            Explore Dutch
          </Link>
          <Link to="/contact" className="hover:text-foreground">
            Contact
          </Link>
          <Link to="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
