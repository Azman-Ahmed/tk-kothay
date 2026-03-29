import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, Wallet, RepeatIcon, CreditCard, 
  Coffee, PiggyBank, BarChart2, Users, FileText, ChevronDown, ChevronRight, Calculator 
} from "lucide-react";
import { cn } from "../../lib/utils";

const navItems = [
  { name: "Dashboard",          href: "/",          icon: LayoutDashboard },
  { name: "Income",             href: "/income",    icon: Wallet },
];

const expenseSubItems = [
  { name: "Recurring Expenses", href: "/expenses",  icon: RepeatIcon },
  { name: "One-Time Payments",  href: "/one-time",  icon: CreditCard },
  { name: "Daily Spend",        href: "/daily",     icon: Coffee },
];

const bottomItems = [
  { name: "Savings",            href: "/savings",   icon: PiggyBank },
  { name: "Personal Loans",     href: "/loans",     icon: Users },
  { name: "Monthly Summary",    href: "/reports",   icon: BarChart2 },
  { name: "Balance Sheet",      href: "/balance",   icon: FileText },
];

export function Sidebar({ className }) {
  const location = useLocation();
  const isExpenseActive = expenseSubItems.some(item => location.pathname === item.href);
  const [expensesOpen, setExpensesOpen] = useState(isExpenseActive);

  const NavItem = ({ item, isSub = false }) => (
    <NavLink
      key={item.name}
      to={item.href}
      end={item.href === "/"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-muted",
          isActive ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" : "text-muted-foreground",
          isSub && "ml-4"
        )
      }
    >
      <item.icon className={cn("shrink-0", isSub ? "h-4 w-4" : "h-5 w-5")} />
      {item.name}
    </NavLink>
  );

  return (
    <aside className={cn("hidden lg:flex w-64 flex-col border-r bg-card h-screen sticky top-0 left-0", className)}>
      <div className="flex h-16 items-center border-b px-6">
        <div className="flex items-center gap-2 font-bold text-xl text-primary">
          <Wallet className="h-6 w-6" />
          <span>MoneyMate</span>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        {navItems.map((item) => <NavItem key={item.name} item={item} />)}

        {/* Grouped Expenses */}
        <div className="space-y-1">
          <button
            onClick={() => setExpensesOpen(!expensesOpen)}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-muted text-muted-foreground",
              isExpenseActive && "text-emerald-600"
            )}
          >
            <div className="flex items-center gap-3">
              <Calculator className="h-5 w-5 shrink-0" />
              <span>Expenses</span>
            </div>
            {expensesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          
          {expensesOpen && (
            <div className="space-y-1">
              {expenseSubItems.map((item) => <NavItem key={item.name} item={item} isSub />)}
            </div>
          )}
        </div>

        {bottomItems.map((item) => <NavItem key={item.name} item={item} />)}
      </nav>
      <div className="border-t p-4 text-xs text-muted-foreground text-center">
        v1.0.0
      </div>
    </aside>
  );
}
