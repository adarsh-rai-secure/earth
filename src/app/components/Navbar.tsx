import Link from "next/link";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <span aria-hidden className="inline-block h-6 w-6 rounded-full bg-brand" />
          <span>Ama Earth Group</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          <a href="#product" className="hover:text-foreground transition-colors">Product</a>
          <a href="#how" className="hover:text-foreground transition-colors">How It Works</a>
          <Link href="/assessments" className="text-foreground hover:text-brand transition-colors font-medium">
            Assessments
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <button className="hidden text-sm text-muted hover:text-foreground transition-colors md:inline-flex">
            Login
          </button>
          <button className="inline-flex h-9 items-center rounded-full bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-hover">
            Start Free Trial
          </button>
        </div>
      </div>
    </header>
  );
}
