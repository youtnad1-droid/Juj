import { Link, useNavigate, getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { Heart, LayoutGrid, Monitor, Moon, Package, Search, Sun, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { flatten } from "@/lib/queries";
import type { CategoryNode } from "@/lib/catalog.schemas";
import { useAuth } from "@/hooks/useAuth";
import { useTheme, type Theme } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-1 font-display text-2xl font-bold tracking-tight">
      <span className="rounded-md bg-primary px-1.5 text-primary-foreground">JUJ</span>
    </Link>
  );
}

function TreeList({ nodes, onPick, depth = 0 }: { nodes: CategoryNode[]; onPick: () => void; depth?: number }) {
  return (
    <ul className={depth ? "ml-3 border-l pl-3" : "space-y-1"}>
      {nodes.map((n) => (
        <li key={n.id}>
          <Link
            to="/catalog/$categorySlug"
            params={{ categorySlug: n.slug }}
            onClick={onPick}
            className={`block rounded-md px-2 py-1.5 hover:bg-accent ${depth ? "text-sm" : "font-medium"}`}
          >
            {n.name}
          </Link>
          {n.children.length > 0 && <TreeList nodes={n.children} onPick={onPick} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

const themes: { v: Theme; label: string; icon: typeof Sun }[] = [
  { v: "light", label: "Light", icon: Sun },
  { v: "dark", label: "Dark", icon: Moon },
  { v: "system", label: "System", icon: Monitor },
];

function ThemeItems() {
  const { theme, setTheme } = useTheme();
  return (
    <>
      <DropdownMenuLabel>Theme</DropdownMenuLabel>
      {themes.map((t) => (
        <DropdownMenuItem key={t.v} onClick={() => setTheme(t.v)} className={theme === t.v ? "bg-accent" : ""}>
          <t.icon className="mr-2 h-4 w-4" /> {t.label}
        </DropdownMenuItem>
      ))}
    </>
  );
}

function ProfileMenu() {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={user ? "secondary" : "default"} size="sm" aria-label="Account">
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">{user ? "Profile" : "Login"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {user ? (
          <>
            <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
            <DropdownMenuItem asChild><Link to="/orders">My orders</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/favorites">Favorites</Link></DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem asChild><Link to="/auth">Log in or sign up</Link></DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <ThemeItems />
        {user && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/" });
              }}
            >
              Log out
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  const tree = getRouteApi("__root__").useLoaderData() as CategoryNode[];
  const hot = flatten(tree).filter((c) => c.show_in_header);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:gap-3">
        <Logo />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="secondary" size="sm"><LayoutGrid className="h-4 w-4" /><span className="hidden md:inline">Catalog</span></Button>
          </SheetTrigger>
          <SheetContent side="left" className="overflow-y-auto">
            <SheetHeader><SheetTitle>Catalog</SheetTitle></SheetHeader>
            <div className="px-4 pb-6"><TreeList nodes={tree} onPick={() => setOpen(false)} /></div>
          </SheetContent>
        </Sheet>
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) navigate({ to: "/search", search: { q: q.trim() } });
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search games, cards, keys…" className="pl-9" maxLength={100} aria-label="Search" />
        </form>
        <Link to="/sell" className="hidden text-sm font-medium hover:text-primary lg:block">Start selling</Link>
        <Button asChild variant="ghost" size="icon" aria-label="Favorites"><Link to="/favorites"><Heart className="h-5 w-5" /></Link></Button>
        <Button asChild variant="ghost" size="icon" aria-label="Orders" className="hidden sm:inline-flex"><Link to="/orders"><Package className="h-5 w-5" /></Link></Button>
        <ProfileMenu />
      </div>
      {hot.length > 0 && <QuickChips items={hot} className="mx-auto max-w-7xl px-4 pb-3" />}
    </header>
  );
}

export function QuickChips({ items, className = "" }: { items: CategoryNode[]; className?: string }) {
  return (
    <div className={`flex gap-2 overflow-x-auto ${className}`}>
      {items.map((c) => (
        <Link
          key={c.id}
          to="/catalog/$categorySlug"
          params={{ categorySlug: c.slug }}
          className="shrink-0 rounded-full border px-3 py-1 text-sm hover:border-primary hover:bg-accent"
          activeProps={{ className: "border-primary bg-accent" }}
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}
