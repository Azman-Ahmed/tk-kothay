import { Moon, Sun, Bell, LogOut, Menu } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import { Button } from "../ui/Button";

export function Topbar() {
  const { theme, toggleTheme, user, handleSignOut, setIsMobileMenuOpen } = useAppContext();

  return (
    <header className="hide-on-print sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-card px-6 shadow-sm">

      <div className="flex items-center gap-4 lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)}>
          <Menu className="h-6 w-6" />
        </Button>
        <span className="font-bold text-xl text-primary">MoneyMate</span>
      </div>
      
      <div className="flex flex-1 justify-end items-center gap-4">
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        
        <div className="flex items-center gap-3 border-l pl-4 ml-2">
          {user ? (
            <>
              <div className="flex flex-col text-right hidden sm:flex">
                <span className="text-sm font-medium">{user.user_metadata?.full_name || user.email?.split("@")[0] || "User"}</span>
                <span className="text-xs text-muted-foreground truncate w-32">{user.email}</span>
              </div>
              <div className="h-9 w-9 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
                {(user.user_metadata?.full_name || user.email || "U").charAt(0).toUpperCase()}
              </div>
              <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out" className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <div className="text-sm text-muted-foreground mr-2">Not logged in</div>
          )}
        </div>
      </div>
    </header>
  );
}
