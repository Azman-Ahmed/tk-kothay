import { useState, useEffect, useCallback } from "react";
import { ArrowUpRight, ArrowDownRight, Wallet, Activity, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from "recharts";
import { getSupabaseBrowserClient } from "../lib/supabase/browser-client";
import { generateDPSSchedule, formatLocalDate } from "../lib/utils";


const COLORS = ["#0ea5e9", "#f43f5e", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getPct(current, previous) {
  if (previous === 0) return current > 0 ? "+100" : "0";
  const pct = (((current - previous) / previous) * 100).toFixed(1);
  return pct > 0 ? `+${pct}` : `${pct}`;
}

function countOccurrences(ym, dayOfWeek) {
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  let count = 0;
  let current = new Date(start);
  while (current <= end) {
    if (current.getDay() === dayOfWeek) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}


export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ balance: 0, income: 0, expense: 0, savings: 0 });
  const [prevStats, setPrevStats] = useState({ income: 0, expense: 0 });
  const [barData, setBarData] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [activeSavingName, setActiveSavingName] = useState("—");
  const [paymentReminders, setPaymentReminders] = useState([]);

  const supabase = getSupabaseBrowserClient();

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed

    const thisMonthStart = new Date(year, month, 1).toISOString().split("T")[0];
    const thisMonthEnd = new Date(year, month + 1, 0).toISOString().split("T")[0];
    const lastMonthStart = new Date(year, month - 1, 1).toISOString().split("T")[0];
    const lastMonthEnd = new Date(year, month, 0).toISOString().split("T")[0];

    // Parallel fetches
    const [
      { data: allIncomes },
      { data: allExpenses },
      { data: allDaily },
      { data: allSavings },
      { data: lastMonthIncomes },
      { data: lastMonthExpenses },
      { data: allLoans },
      { data: allRecurring },
      { data: allDpsPayments },
    ] = await Promise.all([
      supabase.from("incomes").select("amount,date").gte("date", thisMonthStart).lte("date", thisMonthEnd),
      supabase.from("expenses").select("amount,category,date").gte("date", thisMonthStart).lte("date", thisMonthEnd),
      supabase.from("daily_spends").select("amount,date").gte("date", thisMonthStart).lte("date", thisMonthEnd),
      supabase.from("savings_goals").select("*"), // Fetch all goals to filter DPS and get target names
      supabase.from("incomes").select("amount").gte("date", lastMonthStart).lte("date", lastMonthEnd),
      supabase.from("expenses").select("amount").gte("date", lastMonthStart).lte("date", lastMonthEnd),
      supabase.from("loans").select("*").eq("type", "taken").gt("remaining_amount", 0).not("due_date", "is", null),
      supabase.from("recurring_expenses").select("*"),
      supabase.from("dps_payments").select("*"),
    ]);

    const activeMonth = `${year}-${String(month + 1).padStart(2, "0")}`;

    const totalIncome = (allIncomes || []).reduce((s, i) => s + Number(i.amount), 0);
    const totalOneTime = (allExpenses || []).reduce((s, i) => s + Number(i.amount), 0);
    const totalDaily = (allDaily || []).reduce((s, i) => s + Number(i.amount), 0);
    
    // Active Recurring Expenses
    const activeRecurring = (allRecurring || []).filter(r => {
      // If we have the new date fields
      if (r.start_date) {
        const monthStart = `${activeMonth}-01`;
        const lastDay = new Date(year, month + 1, 0).getDate();
        const monthEnd = `${activeMonth}-${String(lastDay).padStart(2, "0")}`;
        
        const isStarted = r.start_date <= monthEnd;
        const isNotEnded = !r.end_date || r.end_date >= monthStart;
        return isStarted && isNotEnded;
      }
      // Fallback
      if (r.start_month) {
        return r.start_month <= activeMonth && (!r.end_month || r.end_month >= activeMonth);
      }
      return false;
    });
    
    const totalRecurring = activeRecurring.reduce((s, r) => {
      const base = Number(r.amount);
      if (r.frequency === "weekly") {
        return s + (base * countOccurrences(activeMonth, r.payment_day || 1));
      }
      return s + base;
    }, 0);



    // Actual Paid DPS Savings
    const totalDps = (allDpsPayments || []).reduce((s, p) => {
      const paidDate = new Date(p.paid_at);
      if (paidDate.getFullYear() === year && paidDate.getMonth() === month) {
         return s + Number(p.amount);
      }
      return s;
    }, 0);

    const totalAllExpenses = totalOneTime + totalDaily + totalRecurring + totalDps;
    const totalSavings = (allSavings || []).reduce((s, g) => s + Number(g.current_amount), 0);
    const balance = totalIncome - totalAllExpenses;

    const prevIncome = (lastMonthIncomes || []).reduce((s, i) => s + Number(i.amount), 0);
    const prevExpense = (lastMonthExpenses || []).reduce((s, i) => s + Number(i.amount), 0);

    setStats({ balance, income: totalIncome, expense: totalAllExpenses, savings: totalSavings });
    setPrevStats({ income: prevIncome, expense: prevExpense });

    // Top active savings goal
    const topGoal = (allSavings || []).find(g => Number(g.current_amount) < Number(g.target_amount));
    setActiveSavingName(topGoal?.name || "No active goal");

    // Pie chart: expenses by category (this month)
    const categoryMap = {};
    (allExpenses || []).forEach(e => { categoryMap[e.category] = (categoryMap[e.category] || 0) + Number(e.amount); });
    if (totalDaily > 0) categoryMap["Daily Spend"] = (categoryMap["Daily Spend"] || 0) + totalDaily;
    if (totalRecurring > 0) categoryMap["Recurring EMI"] = (categoryMap["Recurring EMI"] || 0) + totalRecurring;
    if (totalDps > 0) categoryMap["DPS Savings"] = (categoryMap["DPS Savings"] || 0) + totalDps;
    setPieData(Object.entries(categoryMap).map(([name, value]) => ({ name, value })));

    // Compute Reminders (Loans + DPS)
    const combinedReminders = [];

    (allLoans || []).forEach(l => {
      const due = new Date(l.due_date);
      const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
      if (diffDays <= 7 && diffDays >= -1) {
         combinedReminders.push({
            id: `loan_${l.id}`,
            title: l.partner_name,
            amount: l.remaining_amount,
            due_date: l.due_date,
            type: "loan",
            diffDays
         });
      }
    });

    (allSavings || []).forEach(goal => {
      if (!goal.is_recurring) return;
      const goalPayments = (allDpsPayments || []).filter(p => p.savings_goal_id === goal.id);
      const schedule = generateDPSSchedule(goal, goalPayments);
      
      schedule.forEach(inst => {
        if (inst.status !== "paid") {
           const due = new Date(inst.due_date);
           const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
           if (diffDays <= 7) {
              combinedReminders.push({
                 id: `dps_${goal.id}_${inst.due_date}`,
                 title: `${goal.name} (${inst.status === 'missed' ? 'Missed Installment' : 'Installment'})`,
                 amount: inst.amount,
                 due_date: inst.due_date,
                 type: "dps",
                 diffDays
              });
           }
        }
      });
    });

    combinedReminders.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    setPaymentReminders(combinedReminders);

    // Bar chart: last 6 months income vs expense
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth(), label: MONTH_NAMES[d.getMonth()] });
    }

    const [{ data: sixMonthIncomes }, { data: sixMonthExpenses }, { data: sixMonthDaily }] = await Promise.all([
      supabase.from("incomes").select("amount,date").gte("date", new Date(year, month - 5, 1).toISOString().split("T")[0]),
      supabase.from("expenses").select("amount,date").gte("date", new Date(year, month - 5, 1).toISOString().split("T")[0]),
      supabase.from("daily_spends").select("amount,date").gte("date", new Date(year, month - 5, 1).toISOString().split("T")[0]),
    ]);

    const buildMap = (rows) => {
      const map = {};
      (rows || []).forEach(r => {
        const key = r.date.slice(0, 7); // "YYYY-MM"
        map[key] = (map[key] || 0) + Number(r.amount);
      });
      return map;
    };

    const incomeMap = buildMap(sixMonthIncomes);
    const expenseMap = buildMap(sixMonthExpenses);
    const dailyMap = buildMap(sixMonthDaily);

    setBarData(months.map(m => {
      const key = `${m.year}-${String(m.month + 1).padStart(2, "0")}`;
      const monthStart = `${key}-01`;
      const lastDayM = new Date(m.year, m.month + 1, 0).getDate();
      const monthEnd = `${key}-${String(lastDayM).padStart(2, "0")}`;

      // Add recurring for trend
      const monthlyRec = (allRecurring || []).filter(r => {
          if (r.start_date) {
            return r.start_date <= monthEnd && (!r.end_date || r.end_date >= monthStart);
          }
          if (r.start_month) {
            return r.start_month <= key && (!r.end_month || r.end_month >= key);
          }
          return false;
        })
        .reduce((s, r) => {
          const base = Number(r.amount);
          return s + (r.frequency === "weekly" ? base * countOccurrences(key, r.payment_day || 1) : base);
        }, 0);


      // Add DPS actual payments for trend
      const monthlyDps = (allDpsPayments || []).reduce((s, p) => {
        const pd = new Date(p.paid_at);
        if (pd.getFullYear() === m.year && pd.getMonth() === m.month) {
          return s + Number(p.amount);
        }
        return s;
      }, 0);

      return {
        name: m.label,
        income: incomeMap[key] || 0,
        expense: (expenseMap[key] || 0) + (dailyMap[key] || 0) + monthlyRec + monthlyDps,
      };
    }));


    setLoading(false);
  }, []);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  const statCards = [
    {
      title: "Net Balance",
      value: `৳${stats.balance.toLocaleString()}`,
      icon: Wallet,
      iconColor: "text-muted-foreground",
      valueColor: stats.balance >= 0 ? "text-foreground" : "text-rose-600 dark:text-rose-400",
      sub: "This month",
    },
    {
      title: "Monthly Income",
      value: `৳${stats.income.toLocaleString()}`,
      icon: ArrowUpRight,
      iconColor: "text-emerald-500",
      valueColor: "text-emerald-600 dark:text-emerald-400",
      sub: `${getPct(stats.income, prevStats.income)}% from last month`,
    },
    {
      title: "Monthly Expense",
      value: `৳${stats.expense.toLocaleString()}`,
      icon: ArrowDownRight,
      iconColor: "text-rose-500",
      valueColor: "text-rose-600 dark:text-rose-400",
      sub: `${getPct(stats.expense, prevStats.expense)}% from last month`,
    },
    {
      title: "Total Savings",
      value: `৳${stats.savings.toLocaleString()}`,
      icon: Activity,
      iconColor: "text-blue-500",
      valueColor: "text-foreground",
      sub: `Active: ${activeSavingName}`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your financial overview.</p>
        </div>
        <button onClick={fetchDashboardData} disabled={loading}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <Icon className={`h-4 w-4 ${card.iconColor}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${card.valueColor}`}>{card.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Income vs Expense (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {barData.every(d => d.income === 0 && d.expense === 0) && !loading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No data yet. Add income/expenses to see the chart.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                  <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)", borderRadius: "8px" }}
                    formatter={(value) => [`৳${value.toLocaleString()}`, undefined]} />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Expense" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Expense by Category (This Month)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {pieData.length === 0 && !loading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No expenses this month yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="45%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)", borderRadius: "8px" }}
                    formatter={(value) => [`৳${Number(value).toLocaleString()}`, undefined]} />
                </PieChart>
              </ResponsiveContainer>
            )}
            {pieData.length > 0 && (
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
                {pieData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                    {entry.name}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Reminders Section */}
      {paymentReminders.length > 0 && (
        <Card className="border-rose-200 bg-rose-50/20 dark:bg-rose-950/10">
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            <CardTitle className="text-base text-rose-700 dark:text-rose-400">Payment Reminders</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2">
            {paymentReminders.map(rem => {
               return (
                 <div key={rem.id} className="flex justify-between items-center p-3 rounded-lg border border-rose-100 dark:border-rose-900 bg-card shadow-sm">
                   <div>
                     <p className="font-bold text-sm">{rem.title}</p>
                     <p className={`text-[10px] uppercase font-bold ${rem.diffDays <= 1 ? "text-rose-600" : "text-amber-600"}`}>
                       {rem.diffDays === 0 ? "Due Today" : rem.diffDays === 1 ? "Due Tomorrow" : rem.diffDays < 0 ? "Overdue!" : `Due in ${rem.diffDays} days`}
                     </p>
                   </div>
                   <div className="text-right">
                     <p className="font-extrabold text-rose-600">৳{Number(rem.amount).toLocaleString()}</p>
                     <p className="text-[10px] text-muted-foreground">{rem.due_date}</p>
                   </div>
                 </div>
               );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
