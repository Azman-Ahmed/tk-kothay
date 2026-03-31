import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, RefreshCw,
  ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, TrendingDown,
  PiggyBank, RepeatIcon, CreditCard, Coffee, AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line, ReferenceLine
} from "recharts";
import { getSupabaseBrowserClient } from "../lib/supabase/browser-client";

// ── helpers ──────────────────────────────────────────────────────────────────
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function toYearMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(ym) {
  if (!ym) return "—";
  const [y, m] = ym.split("-");
  return `${MONTHS[parseInt(m) - 1]} ${y}`;
}
function addMonths(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return toYearMonth(d);
}
function monthRange(ym) {
  const [y, m] = ym.split("-");
  const start = `${y}-${m}-01`;
  const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
  const end = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}
function pctChange(curr, prev) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return parseFloat((((curr - prev) / prev) * 100).toFixed(1));
}
function fmt(n) { return Number(n || 0).toLocaleString(); }
// Count occurrences of a specific day of the week (0-6) in a month (YYYY-MM)
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

// Effective monthly contribution for a DPS savings goal
function dpsMonthlyAmount(goal, ym) {
  const base = Number(goal.monthly_amount || 0);
  return goal.frequency === "weekly" ? base * countOccurrences(ym, 1) : base; // Defaulting to Monday (1) for legacy DPS weeks
}


const PIE_COLORS = ["#6366f1", "#f43f5e", "#f59e0b", "#10b981", "#ec4899", "#0ea5e9", "#8b5cf6"];
const SEGMENT_COLORS = {
  "Income":       "#10b981",
  "Recurring":    "#6366f1",
  "One-Time":     "#ec4899",
  "Daily Spend":  "#f59e0b",
  "DPS Savings":  "#0ea5e9",
};

// ── Custom tooltip ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 min-w-[160px]">
      <p className="text-xs font-semibold text-muted-foreground mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
            {p.name}
          </span>
          <span className="font-semibold">৳{Number(p.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

// ── Stat card component ──────────────────────────────────────────────────────
function StatCard({ title, value, sub, icon: Icon, iconColor, badge, badgePositive }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center gap-2 mt-1">
          {badge !== undefined && (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${badgePositive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"}`}>
              {badgePositive ? "+" : ""}{badge}%
            </span>
          )}
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function Reports() {
  const [selectedMonth, setSelectedMonth] = useState(toYearMonth(new Date()));
  const [loading, setLoading] = useState(true);

  // Current month data
  const [income, setIncome] = useState(0);
  const [recurring, setRecurring] = useState(0);
  const [oneTime, setOneTime] = useState(0);
  const [daily, setDaily] = useState(0);
  const [dpsSavings, setDpsSavings] = useState(0);

  // Previous month for comparison
  const [prevIncome, setPrevIncome] = useState(0);
  const [prevRecurring, setPrevRecurring] = useState(0);
  const [prevOneTime, setPrevOneTime] = useState(0);
  const [prevDaily, setPrevDaily] = useState(0);

  // Charts
  const [trendData, setTrendData] = useState([]);
  const [expBreakdownPie, setExpBreakdownPie] = useState([]);
  const [incomeBySource, setIncomeBySource] = useState([]);
  const [dailyLineData, setDailyLineData] = useState([]);

  // Insights
  const [topSpendDay, setTopSpendDay] = useState(null);
  const [slowestDay, setSlowestDay] = useState(null);
  const [avgDailySpend, setAvgDailySpend] = useState(0);

  const supabase = getSupabaseBrowserClient();

  const shiftMonth = (delta) => {
    const [y, m] = selectedMonth.split("-").map(Number);
    setSelectedMonth(toYearMonth(new Date(y, m - 1 + delta, 1)));
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { start, end } = monthRange(selectedMonth);
    const prevMonth = addMonths(selectedMonth, -1);
    const { start: prevStart, end: prevEnd } = monthRange(prevMonth);

    // ── Parallel fetches ──
    const [
      { data: incomes },
      { data: expenses },
      { data: dailySpends },
      { data: allRecurring },
      { data: allDpsSavings },
      { data: prevIncomes },
      { data: prevExpenses },
      { data: prevDailySpends },
      // 6-month trend
      { data: trend6Incomes },
      { data: trend6Expenses },
      { data: trend6Daily },
    ] = await Promise.all([
      supabase.from("incomes").select("amount, source").gte("date", start).lte("date", end),
      supabase.from("expenses").select("amount, category, date").gte("date", start).lte("date", end),
      supabase.from("daily_spends").select("amount, date").gte("date", start).lte("date", end),
      supabase.from("recurring_expenses").select("*"),
      supabase.from("savings_goals").select("*").eq("is_recurring", true),
      supabase.from("incomes").select("amount").gte("date", prevStart).lte("date", prevEnd),
      supabase.from("expenses").select("amount").gte("date", prevStart).lte("date", prevEnd),
      supabase.from("daily_spends").select("amount").gte("date", prevStart).lte("date", prevEnd),
      supabase.from("incomes").select("amount, date").gte("date", addMonths(selectedMonth, -5).replace(/\d+$/, "01")).lte("date", end),
      supabase.from("expenses").select("amount, date").gte("date", addMonths(selectedMonth, -5).replace(/\d+$/, "01")).lte("date", end),
      supabase.from("daily_spends").select("amount, date").gte("date", addMonths(selectedMonth, -5).replace(/\d+$/, "01")).lte("date", end),
    ]);

    // Current month totals
    const totalIncome = (incomes || []).reduce((s, i) => s + Number(i.amount), 0);
    const totalOneTime = (expenses || []).reduce((s, e) => s + Number(e.amount), 0);
    const totalDaily = (dailySpends || []).reduce((s, d) => s + Number(d.amount), 0);

    // Active EMI this month
    const activeRecurring = (allRecurring || []).filter(r => {
      // Safety Fallback: Use old start_month if new start_date is missing
      if (r.start_date && r.end_date) {
        return r.start_date <= end && r.end_date >= start;
      }
      return r.start_month <= selectedMonth && r.end_month >= selectedMonth;
    });
    const totalRecurring = activeRecurring.reduce((s, r) => {
      const base = Number(r.amount);
      if (r.frequency === "weekly") {
        return s + (base * countOccurrences(selectedMonth, r.payment_day));
      }
      return s + base;
    }, 0);


    // Active DPS this month
    const activeDps = (allDpsSavings || []).filter(g => {
      if (!g.start_month || !g.duration_months) return false;
      const endMonth = addMonths(g.start_month, g.duration_months - 1);
      return g.start_month <= selectedMonth && endMonth >= selectedMonth;
    });
    const totalDps = activeDps.reduce((s, g) => s + dpsMonthlyAmount(g, selectedMonth), 0);

    // Previous month
    const pIncome = (prevIncomes || []).reduce((s, i) => s + Number(i.amount), 0);
    const pOneTime = (prevExpenses || []).reduce((s, e) => s + Number(e.amount), 0);
    const pDaily = (prevDailySpends || []).reduce((s, d) => s + Number(d.amount), 0);
    const prevActiveRec = (allRecurring || []).filter(r => {
      // Safety Fallback
      if (r.start_date && r.end_date) {
        return r.start_date <= prevEnd && r.end_date >= prevStart;
      }
      return r.start_month <= prevMonth && r.end_month >= prevMonth;
    });
    const pRecurring = prevActiveRec.reduce((s, r) => {
      const base = Number(r.amount);
      if (r.frequency === "weekly") {
        return s + (base * countOccurrences(prevMonth, r.payment_day));
      }
      return s + base;
    }, 0);


    setIncome(totalIncome);
    setOneTime(totalOneTime);
    setDaily(totalDaily);
    setRecurring(totalRecurring);
    setDpsSavings(totalDps);
    setPrevIncome(pIncome);
    setPrevOneTime(pOneTime);
    setPrevDaily(pDaily);
    setPrevRecurring(pRecurring);

    // Expense breakdown pie
    const pieSlices = [];
    if (totalRecurring > 0) pieSlices.push({ name: "Recurring EMI", value: totalRecurring });
    if (totalOneTime > 0)  pieSlices.push({ name: "One-Time",      value: totalOneTime });
    if (totalDaily > 0)    pieSlices.push({ name: "Daily Spend",   value: totalDaily });
    if (totalDps > 0)      pieSlices.push({ name: "DPS Savings",   value: totalDps });
    setExpBreakdownPie(pieSlices);

    // Income by source
    const srcMap = {};
    (incomes || []).forEach(i => { srcMap[i.source] = (srcMap[i.source] || 0) + Number(i.amount); });
    setIncomeBySource(Object.entries(srcMap).map(([name, value]) => ({ name, value })));

    // Daily spend line chart for this month
    const dayMap = {};
    (dailySpends || []).forEach(d => { dayMap[d.date] = (dayMap[d.date] || 0) + Number(d.amount); });
    const sortedDays = Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b));
    const lineData = sortedDays.map(([date, total]) => ({ date: date.slice(8), total })); // just DD
    setDailyLineData(lineData);

    // Insights
    if (sortedDays.length > 0) {
      const max = sortedDays.reduce((a, b) => b[1] > a[1] ? b : a);
      const min = sortedDays.reduce((a, b) => b[1] < a[1] ? b : a);
      setTopSpendDay({ date: max[0], amount: max[1] });
      setSlowestDay({ date: min[0], amount: min[1] });
      setAvgDailySpend(Math.round(totalDaily / sortedDays.length));
    } else {
      setTopSpendDay(null); setSlowestDay(null); setAvgDailySpend(0);
    }

    // 6-month trend
    const months6 = [];
    for (let i = 5; i >= 0; i--) months6.push(addMonths(selectedMonth, -i));
    const buildMonthMap = (rows) => {
      const map = {};
      (rows || []).forEach(r => { const key = r.date.slice(0, 7); map[key] = (map[key] || 0) + Number(r.amount); });
      return map;
    };
    const incMap = buildMonthMap(trend6Incomes);
    const expMap = buildMonthMap(trend6Expenses);
    const dayMap6 = buildMonthMap(trend6Daily);

    // Also add recurring EMI to each month in trend
    setTrendData(months6.map(ym => {
      const { start: mStart, end: mEnd } = monthRange(ym);
      const activeRec = (allRecurring || []).filter(r => {
        // Safety Fallback
        if (r.start_date && r.end_date) {
          return r.start_date <= mEnd && r.end_date >= mStart;
        }
        return r.start_month <= ym && r.end_month >= ym;
      });
      const recAmt = activeRec.reduce((s, r) => {
        const base = Number(r.amount);
        if (r.frequency === "weekly") {
          return s + (base * countOccurrences(ym, r.payment_day));
        }
        return s + base;
      }, 0);

      const activeDpsM = (allDpsSavings || []).filter(g => {
        if (!g.start_month || !g.duration_months) return false;
        return g.start_month <= ym && addMonths(g.start_month, g.duration_months - 1) >= ym;
      });
      const dpsAmt = activeDpsM.reduce((s, g) => s + dpsMonthlyAmount(g, ym), 0);
      return {
        name: monthLabel(ym).slice(0, 3),
        Income: incMap[ym] || 0,
        "One-Time": expMap[ym] || 0,
        "Daily":    dayMap6[ym] || 0,
        "Recurring": recAmt,
        "DPS":      dpsAmt,
      };
    }));

    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalExpenses = recurring + oneTime + daily + dpsSavings;
  const netBalance = income - totalExpenses;
  const savingsRate = income > 0 ? Math.round(((income - (recurring + oneTime + daily)) / income) * 100) : 0;

  const incPct = pctChange(income, prevIncome);
  const expPct = pctChange(totalExpenses, prevRecurring + prevOneTime + prevDaily);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monthly Summary</h1>
          <p className="text-muted-foreground">Full income vs expense breakdown with statistics.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-2 py-1.5">
            <button onClick={() => shiftMonth(-1)} className="p-1 rounded hover:bg-muted transition-colors"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm font-semibold w-28 text-center">{monthLabel(selectedMonth)}</span>
            <button onClick={() => shiftMonth(1)} className="p-1 rounded hover:bg-muted transition-colors"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 px-3 py-2 rounded-lg hover:bg-muted">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Income"        value={`৳${fmt(income)}`}        icon={ArrowUpRight}    iconColor="text-emerald-500" badge={incPct}   badgePositive={incPct >= 0}   sub="vs last month" />
        <StatCard title="Total Outflow"       value={`৳${fmt(totalExpenses)}`} icon={ArrowDownRight}  iconColor="text-rose-500"    badge={expPct}   badgePositive={expPct < 0}    sub="vs last month" />
        <StatCard title="Net Balance"         value={`৳${fmt(netBalance)}`}    icon={Wallet}          iconColor={netBalance >= 0 ? "text-emerald-500" : "text-rose-500"} sub={netBalance >= 0 ? "You're in the green 🎉" : "Overspent this month"} />
        <StatCard title="Savings Rate"        value={`${savingsRate}%`}        icon={TrendingUp}      iconColor="text-blue-500"    sub="of income kept after expenses" />
      </div>

      {/* ── Expense breakdown cards ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Recurring / EMI",    value: recurring,  icon: RepeatIcon,  color: "indigo",  pct: income > 0 ? Math.round((recurring / income) * 100) : 0 },
          { label: "One-Time Payments",  value: oneTime,    icon: CreditCard,  color: "pink",    pct: income > 0 ? Math.round((oneTime / income) * 100) : 0 },
          { label: "Daily Spend",        value: daily,      icon: Coffee,      color: "amber",   pct: income > 0 ? Math.round((daily / income) * 100) : 0 },
          { label: "DPS Contributions",  value: dpsSavings, icon: PiggyBank,   color: "sky",     pct: income > 0 ? Math.round((dpsSavings / income) * 100) : 0 },
        ].map(({ label, value, icon: Icon, color, pct }) => (
          <div key={label} className={`bg-${color}-50 dark:bg-${color}-950/30 border border-${color}-200 dark:border-${color}-800 rounded-lg px-4 py-3`}>
            <div className="flex items-center justify-between mb-1">
              <p className={`text-xs font-medium text-${color}-700 dark:text-${color}-400`}>{label}</p>
              <Icon className={`h-4 w-4 text-${color}-500`} />
            </div>
            <p className={`text-xl font-bold text-${color}-700 dark:text-${color}-300`}>৳{fmt(value)}</p>
            <div className="mt-2 h-1.5 w-full bg-white/50 dark:bg-black/20 rounded-full overflow-hidden">
              <div className={`h-full bg-${color}-500 rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <p className={`text-xs text-${color}-600 dark:text-${color}-500 mt-1`}>{pct}% of income</p>
          </div>
        ))}
      </div>

      {/* ── Charts Row 1 ── */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* 6-month stacked bar */}
        <Card className="lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">6-Month Income vs Expense Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {trendData.every(d => d.Income === 0 && d["One-Time"] === 0 && d.Daily === 0) ? (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">No data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `৳${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)" }} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar dataKey="Income"    stackId="income"   fill="#10b981" name="Income"    radius={[4,4,0,0]} />
                  <Bar dataKey="Recurring" stackId="expense"  fill="#6366f1" name="Recurring" />
                  <Bar dataKey="One-Time"  stackId="expense"  fill="#ec4899" name="One-Time" />
                  <Bar dataKey="Daily"     stackId="expense"  fill="#f59e0b" name="Daily" />
                  <Bar dataKey="DPS"       stackId="expense"  fill="#0ea5e9" name="DPS"        radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Expense breakdown pie */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Expense Breakdown — {monthLabel(selectedMonth)}</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {expBreakdownPie.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">No expenses this month.</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="68%">
                  <PieChart>
                    <Pie data={expBreakdownPie} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                      {expBreakdownPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => [`৳${Number(v).toLocaleString()}`, undefined]} contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
                  {expBreakdownPie.map((entry, i) => (
                    <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground">{entry.name}</span>
                      <span className="font-semibold">৳{fmt(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Charts Row 2 ── */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Daily spend line chart */}
        <Card className="lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Daily Spend Activity — {monthLabel(selectedMonth)}</CardTitle>
          </CardHeader>
          <CardContent className="h-[240px]">
            {dailyLineData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">No daily spends this month.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyLineData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} label={{ value: "Day", position: "insideBottom", offset: -2, fontSize: 11 }} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `৳${v}`} />
                  <Tooltip formatter={v => [`৳${Number(v).toLocaleString()}`, "Spent"]} contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px" }} />
                  {avgDailySpend > 0 && <ReferenceLine y={avgDailySpend} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "avg", fill: "#f59e0b", fontSize: 10 }} />}
                  <Line type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: "#f59e0b" }} activeDot={{ r: 5 }} name="Daily Spend" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Income by source */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Income Sources — {monthLabel(selectedMonth)}</CardTitle>
          </CardHeader>
          <CardContent>
            {incomeBySource.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">No income this month.</div>
            ) : (
              <div className="space-y-3 pt-2">
                {incomeBySource.map(({ name, value }, i) => {
                  const pct = income > 0 ? Math.round((value / income) * 100) : 0;
                  return (
                    <div key={name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{name}</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">৳{fmt(value)} <span className="text-xs text-muted-foreground">({pct}%)</span></span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Insights & Stats ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Net balance indicator */}
        <Card className={`border-l-4 ${netBalance >= 0 ? "border-l-emerald-500" : "border-l-rose-500"}`}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              {netBalance >= 0
                ? <TrendingUp className="h-4 w-4 text-emerald-500" />
                : <TrendingDown className="h-4 w-4 text-rose-500" />}
              <span className="text-xs font-medium text-muted-foreground">Net Balance</span>
            </div>
            <p className={`text-2xl font-bold ${netBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {netBalance >= 0 ? "+" : ""}৳{fmt(netBalance)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {netBalance >= 0 ? "Surplus — well done! 🎉" : "Deficit — overspent income"}
            </p>
          </CardContent>
        </Card>

        {/* Avg daily spend */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Coffee className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground">Avg Daily Spend</span>
            </div>
            <p className="text-2xl font-bold">৳{fmt(avgDailySpend)}</p>
            <p className="text-xs text-muted-foreground mt-1">per active spending day</p>
          </CardContent>
        </Card>

        {/* Top spend day */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-rose-500" />
              <span className="text-xs font-medium text-muted-foreground">Highest Spend Day</span>
            </div>
            {topSpendDay ? (
              <>
                <p className="text-2xl font-bold">৳{fmt(topSpendDay.amount)}</p>
                <p className="text-xs text-muted-foreground mt-1">{topSpendDay.date}</p>
              </>
            ) : <p className="text-muted-foreground text-sm mt-2">No data yet</p>}
          </CardContent>
        </Card>

        {/* Spending vs income alert */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">Expense/Income Ratio</span>
            </div>
            {income > 0 ? (
              <>
                <p className="text-2xl font-bold">{Math.round((totalExpenses / income) * 100)}%</p>
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${totalExpenses / income > 0.9 ? "bg-rose-500" : totalExpenses / income > 0.7 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${Math.min((totalExpenses / income) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {totalExpenses / income > 0.9 ? "⚠️ Very high spending" : totalExpenses / income > 0.7 ? "Moderate spending" : "✅ Healthy ratio"}
                </p>
              </>
            ) : <p className="text-muted-foreground text-sm mt-2">No income data</p>}
          </CardContent>
        </Card>
      </div>

      {/* ── Detailed breakdown table ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Complete Breakdown — {monthLabel(selectedMonth)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs">
                  <th className="text-left py-2 font-medium">Category</th>
                  <th className="text-right py-2 font-medium">Amount</th>
                  <th className="text-right py-2 font-medium">% of Income</th>
                  <th className="py-2 pl-4 w-48">Visual</th>
                </tr>
              </thead>
              <tbody>
                {/* Income row */}
                <tr className="border-b border-border bg-emerald-50/50 dark:bg-emerald-950/10">
                  <td className="py-2.5 font-semibold flex items-center gap-2"><ArrowUpRight className="h-4 w-4 text-emerald-500" /> Total Income</td>
                  <td className="py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">৳{fmt(income)}</td>
                  <td className="py-2.5 text-right">100%</td>
                  <td className="py-2.5 pl-4">
                    <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: "100%" }} /></div>
                  </td>
                </tr>
                {/* Expense rows */}
                {[
                  { label: "Recurring / EMI", amount: recurring, color: "bg-indigo-500" },
                  { label: "One-Time Payments", amount: oneTime, color: "bg-pink-500" },
                  { label: "Daily Spend", amount: daily, color: "bg-amber-400" },
                  { label: "DPS Savings Contribution", amount: dpsSavings, color: "bg-sky-500" },
                ].map(({ label, amount, color }) => {
                  if (amount === 0) return null;
                  const pct = income > 0 ? Math.round((amount / income) * 100) : 0;
                  return (
                    <tr key={label} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 pl-4 text-muted-foreground">{label}</td>
                      <td className="py-2.5 text-right font-semibold text-rose-600 dark:text-rose-400">- ৳{fmt(amount)}</td>
                      <td className="py-2.5 text-right text-muted-foreground">{pct}%</td>
                      <td className="py-2.5 pl-4">
                        <div className="h-2 bg-muted rounded-full overflow-hidden"><div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                      </td>
                    </tr>
                  );
                })}
                {/* Net balance footer */}
                <tr className="border-t-2 border-border">
                  <td className="py-3 font-bold">Net Balance</td>
                  <td className={`py-3 text-right font-bold text-lg ${netBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {netBalance >= 0 ? "+" : ""}৳{fmt(netBalance)}
                  </td>
                  <td className="py-3 text-right font-semibold">
                    {income > 0 ? `${100 - Math.min(Math.round((totalExpenses / income) * 100), 100)}% left` : "—"}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
