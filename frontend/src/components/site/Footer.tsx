import { Link } from "@tanstack/react-router";
import { Logo } from "./Header";

export function Footer() {
  return (
    <footer className="mt-16 border-t bg-card">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm text-muted-foreground">Digital goods from trusted sellers. Your money is held until you get your item.</p>
        </div>
        <div>
          <h3 className="mb-3 font-semibold">Partners</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/sell" className="hover:text-foreground">Start selling</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-semibold">Buyers</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/search" search={{ q: "" }} className="hover:text-foreground">Search</Link></li>
            <li><Link to="/favorites" className="hover:text-foreground">Favorites</Link></li>
            <li><Link to="/orders" className="hover:text-foreground">My orders</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-semibold">Company</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Support: <a href="mailto:support@juj.gg" className="text-foreground hover:underline">support@juj.gg</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} JUJ</div>
    </footer>
  );
}
