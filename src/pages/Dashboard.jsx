import { useState, useEffect, useCallback } from "react";
import { ArrowUpRight, ArrowDownRight, Wallet, Activity, RefreshCw, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
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
  const [stats, setStats] = useState({ balance: 0, income: 0, expense: 0, savings: 0, carryForward: 0 });
  const [prevStats, setPrevStats] = useState({ income: 0, expense: 0 });
  const [barData, setBarData] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [activeSavingName, setActiveSavingName] = useState("—");
  const [paymentReminders, setPaymentReminders] = useState([]);
  const [payingBill, setPayingBill] = useState(null);
  const [quickAdd, setQuickAdd] = useState({ amount: "", note: "", payment_method: "debit" });
  const [addingQuick, setAddingQuick] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`); // "YYYY-MM"

  const shiftMonth = (delta) => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const ny = d.getFullYear();
    const nm = String(d.getMonth() + 1).padStart(2, "0");
    setSelectedMonth(`${ny}-${nm}`);
  };

  const supabase = getSupabaseBrowserClient();

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [selY, monthMinusOne] = selectedMonth.split("-").map(Number);
      const selM = monthMinusOne; // 1-indexed
      const year = selY;
      const month = selM - 1; // 0-indexed for JS Date
      const now = new Date();

      // Parallel fetches for ALL time
      const [
        { data: allIncomes },
        { data: allExpenses },
        { data: allDaily },
        { data: allSavings },
        { data: allLoans },
        { data: allRecurring },
        { data: allDpsPayments },
        { data: creditBillPayments },
        { data: loanPayments },
      ] = await Promise.all([
        supabase.from("incomes").select("amount,date"),
        supabase.from("expenses").select("amount,category,date,payment_method"),
        supabase.from("daily_spends").select("amount,date,payment_method"),
        supabase.from("savings_goals").select("*"),
        supabase.from("loans").select("*"), 
        supabase.from("recurring_expenses").select("*"),
        supabase.from("dps_payments").select("*"),
        supabase.from("credit_bill_payments").select("*"),
        supabase.from("loan_payments").select("*"),
      ]);

      const calculateMonthStats = (mStr) => {
        const [yNum, mNum] = mStr.split("-").map(Number);
        const mIdx = mNum - 1;
        const lastDay = new Date(yNum, mNum, 0).getDate();
        const mStart = `${yNum}-${String(mNum).padStart(2, "0")}-01`;
        const mEnd = `${yNum}-${String(mNum).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        const activeMonth = mStr;

        const baseIncome = (allIncomes || [])
          .filter(i => i.date >= mStart && i.date <= mEnd)
          .reduce((s, i) => s + Number(i.amount), 0);
          
        const loanIncome = (allLoans || [])
          .filter(l => l.type === 'taken' && l.start_date >= mStart && l.start_date <= mEnd)
          .reduce((s, l) => s + Number(l.amount), 0);
          
        const givenLoanRepayments = (loanPayments || []).filter(p => {
          const l = (allLoans || []).find(x => x.id === p.loan_id);
          if (!l || l.type !== 'given') return false;
          const pd = new Date(p.paid_at);
          return pd.getFullYear() === yNum && pd.getMonth() === mIdx;
        }).reduce((s, p) => s + Number(p.amount), 0);
        
        const totalIncome = baseIncome + loanIncome + givenLoanRepayments;

        const totalOneTime = (allExpenses || [])
          .filter(i => i.date >= mStart && i.date <= mEnd)
          .reduce((s, i) => i.payment_method === 'credit' ? s : s + Number(i.amount), 0);
          
        const totalDaily = (allDaily || [])
          .filter(i => i.date >= mStart && i.date <= mEnd)
          .reduce((s, i) => i.payment_method === 'credit' ? s : s + Number(i.amount), 0);
          
        const activeRecurring = (allRecurring || []).filter(r => {
          if (r.start_date) {
            const monthStartStr = `${activeMonth}-01`;
            const rLastDay = new Date(yNum, mNum, 0).getDate();
            const monthEndStr = `${activeMonth}-${String(rLastDay).padStart(2, "0")}`;
            return r.start_date <= monthEndStr && (!r.end_date || r.end_date >= monthStartStr);
          }
          if (r.start_month) {
            return r.start_month <= activeMonth && (!r.end_month || r.end_month >= activeMonth);
          }
          return false;
        });
        
        const totalRecurring = activeRecurring.reduce((s, r) => {
          const base = Number(r.amount);
          if (r.frequency === "weekly") return s + (base * countOccurrences(activeMonth, r.payment_day || 1));
          return s + base;
        }, 0);

        const totalDps = (allDpsPayments || []).reduce((s, p) => {
          if (p.payment_method === 'credit') return s;
          const pd = new Date(p.paid_at);
          if (pd.getFullYear() === yNum && pd.getMonth() === mIdx) return s + Number(p.amount);
          return s;
        }, 0);

        const loansGiven = (allLoans || [])
          .filter(l => l.type === 'given' && l.start_date >= mStart && l.start_date <= mEnd)
          .reduce((s, l) => s + Number(l.amount), 0);
          
        const takenLoanRepayments = (loanPayments || []).filter(p => {
           if (p.payment_method === 'credit') return false;
           const l = (allLoans || []).find(x => x.id === p.loan_id);
           if (!l || l.type !== 'taken') return false;
           const pd = new Date(p.paid_at);
           return pd.getFullYear() === yNum && pd.getMonth() === mIdx;
        }).reduce((s, p) => s + Number(p.amount), 0);

        const creditBillsPaid = (creditBillPayments || []).filter(p => {
           const pd = new Date(p.paid_at);
           return pd.getFullYear() === yNum && pd.getMonth() === mIdx;
        }).reduce((s, p) => s + Number(p.amount), 0);

        const totalAllExpenses = totalOneTime + totalDaily + totalRecurring + totalDps + loansGiven + takenLoanRepayments + creditBillsPaid;

        const categoryMap = {};
        (allExpenses || [])
          .filter(e => e.date >= mStart && e.date <= mEnd)
          .forEach(e => { categoryMap[e.category] = (categoryMap[e.category] || 0) + Number(e.amount); });

        return {
          totalIncome,
          totalAllExpenses,
          totalDaily,
          totalRecurring,
          totalDps,
          categoryMap
        };
      };

      // Determine the earliest record date to start calculating carry forward
      let earliestDateStr = null;
      const allDates = [];
      if (allIncomes) allIncomes.forEach(i => allDates.push(i.date));
      if (allExpenses) allExpenses.forEach(e => allDates.push(e.date));
      if (allDaily) allDaily.forEach(d => allDates.push(d.date));
      if (allLoans) allLoans.forEach(l => { if(l.start_date) allDates.push(l.start_date); else allDates.push(l.created_at.split('T')[0]); });
      
      if (allDates.length > 0) {
        allDates.sort();
        earliestDateStr = allDates[0];
      } else {
        earliestDateStr = `${selY}-${String(selM).padStart(2, "0")}-01`;
      }

      let [currentY, currentM] = earliestDateStr.split("-").map(Number);
      let carryForward = 0;
      
      // Calculate carry forward cumulatively, flooring at 0 each month
      while (currentY < selY || (currentY === selY && currentM < selM)) {
         const mStr = `${currentY}-${String(currentM).padStart(2, '0')}`;
         const stats = calculateMonthStats(mStr);
         carryForward = Math.max(0, carryForward + stats.totalIncome - stats.totalAllExpenses);
         
         currentM++;
         if (currentM > 12) {
           currentM = 1;
           currentY++;
         }
      }

      const currentStats = calculateMonthStats(selectedMonth);
      
      let lastM = selM - 1;
      let lastY = selY;
      if (lastM === 0) { lastM = 12; lastY--; }
      const lastMonthStr = `${lastY}-${String(lastM).padStart(2, "0")}`;
      const lastStats = calculateMonthStats(lastMonthStr);

      const totalAllExpenses = currentStats.totalAllExpenses;
      const totalSavings = (allSavings || []).reduce((s, g) => s + Number(g.current_amount), 0);
      const balance = carryForward + currentStats.totalIncome - totalAllExpenses;

      window.__dashboard_allExpenses = allExpenses; // store them globally temporarily for credit logic downward
      window.__dashboard_allDaily = allDaily; 
      
      setStats({ 
        balance, 
        income: currentStats.totalIncome, 
        expense: totalAllExpenses, 
        savings: totalSavings,
        carryForward 
      });
      setPrevStats({ income: lastStats.totalIncome, expense: lastStats.totalAllExpenses });

    // Top active savings goal
    const topGoal = (allSavings || []).find(g => Number(g.current_amount) < Number(g.target_amount));
    setActiveSavingName(topGoal?.name || "No active goal");

    // Pie chart: expenses by category (this month)
    const categoryMap = currentStats.categoryMap;
    if (currentStats.totalDaily > 0) categoryMap["Daily Spend"] = (categoryMap["Daily Spend"] || 0) + currentStats.totalDaily;
    if (currentStats.totalRecurring > 0) categoryMap["Recurring EMI"] = (categoryMap["Recurring EMI"] || 0) + currentStats.totalRecurring;
    if (currentStats.totalDps > 0) categoryMap["DPS Savings"] = (categoryMap["DPS Savings"] || 0) + currentStats.totalDps;
    setPieData(Object.entries(categoryMap).map(([name, value]) => ({ name, value })));

    // Compute Reminders (Loans + DPS)
    const combinedReminders = [];

    (allLoans || []).forEach(l => {
      const [y, m, d] = l.due_date.split("-").map(Number);
      const due = new Date(y, m - 1, d);
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
           const [y, m, d] = inst.due_date.split("-").map(Number);
           const due = new Date(y, m - 1, d);
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

    // Credit Bills logic
    const lastMonthKey = `${month === 0 ? year - 1 : year}-${String(month === 0 ? 12 : month).padStart(2, "0")}`;
    const cb_lmY = month === 0 ? year - 1 : year;
    const cb_lmM = month === 0 ? 11 : month - 1; // 0-indexed

    const lmStart = `${cb_lmY}-${String(cb_lmM + 1).padStart(2, "0")}-01`;
    const lmEnd = `${cb_lmY}-${String(cb_lmM + 1).padStart(2, "0")}-${String(new Date(cb_lmY, cb_lmM + 1, 0).getDate()).padStart(2, "0")}`;
    const lastMonthExpensesList = (window.__dashboard_allExpenses || []).filter(e => e.date >= lmStart && e.date <= lmEnd);
    const allDailyLastMonthList = (window.__dashboard_allDaily || []).filter(e => e.date >= lmStart && e.date <= lmEnd);

    const lastMonthCreditExpenses = lastMonthExpensesList.reduce((s, e) => e.payment_method === 'credit' ? s + Number(e.amount) : s, 0);
    const lastMonthCreditDaily = allDailyLastMonthList.reduce((s, e) => e.payment_method === 'credit' ? s + Number(e.amount) : s, 0);
    
    const lastMonthCreditDps = (allDpsPayments || []).filter(p => {
       const pd = new Date(p.paid_at);
       return p.payment_method === 'credit' && pd.getFullYear() === cb_lmY && pd.getMonth() === cb_lmM;
    }).reduce((s, p) => s + Number(p.amount), 0);

    const lastMonthCreditLoanPayments = (loanPayments || []).filter(p => {
       const pd = new Date(p.paid_at);
       return p.payment_method === 'credit' && pd.getFullYear() === cb_lmY && pd.getMonth() === cb_lmM;
    }).reduce((s, p) => s + Number(p.amount), 0);

    const totalCreditBill = lastMonthCreditExpenses + lastMonthCreditDaily + lastMonthCreditDps + lastMonthCreditLoanPayments;
    const isCreditBillPaid = (creditBillPayments || []).some(b => b.bill_month === lastMonthKey);

    if (totalCreditBill > 0 && !isCreditBillPaid) {
       combinedReminders.push({
           id: `credit_bill_${lastMonthKey}`,
           title: `Credit Card Bill (${MONTH_NAMES[lmM]})`,
           amount: totalCreditBill,
           due_date: new Date(year, month, 1).toISOString().split('T')[0],
           type: "credit_bill",
           diffDays: 0, // Force display
           original_month: lastMonthKey
       });
    }

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


    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase, selectedMonth]);

  const handlePayCreditBill = async (rem) => {
    setPayingBill(rem.id);
    await supabase.from("credit_bill_payments").insert([{
      bill_month: rem.original_month,
      amount: rem.amount,
      paid_at: new Date().toISOString()
    }]);
    setPayingBill(null);
    fetchDashboardData();
  };
  
  const handleQuickAdd = async () => {
    if (!quickAdd.amount || !quickAdd.note.trim()) return;
    setAddingQuick(true);
    const { error } = await supabase.from("daily_spends").insert([{
      amount: Number(quickAdd.amount),
      note: quickAdd.note,
      date: new Date().toISOString().split('T')[0],
      payment_method: quickAdd.payment_method
    }]);
    if (!error) {
      setQuickAdd({ amount: "", note: "", payment_method: "debit" });
      fetchDashboardData();
    }
    setAddingQuick(false);
  };

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData, selectedMonth]);

  const statCards = [
    {
      title: "Net Balance",
      value: `৳${stats.balance.toLocaleString()}`,
      icon: Wallet,
      iconColor: "text-muted-foreground",
      valueColor: stats.balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
      sub: stats.carryForward > 0 
        ? `Incl. ৳${stats.carryForward.toLocaleString()} unused from past` 
        : "This month",
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Welcome back! Here's your financial overview.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-2 py-1.5 shadow-sm">
            <button 
              onClick={() => shiftMonth(-1)} 
              className="p-1 rounded hover:bg-muted transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 px-2 border-x border-border/50">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold min-w-[100px] text-center">
                {MONTH_NAMES[parseInt(selectedMonth.split("-")[1]) - 1]} {selectedMonth.split("-")[0]}
              </span>
            </div>
            <button 
              onClick={() => shiftMonth(1)} 
              className="p-1 rounded hover:bg-muted transition-colors"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 px-3 font-semibold border-primary/20 hover:bg-primary/5 hover:text-primary transition-all"
            onClick={() => setSelectedMonth(new Date().toISOString().slice(0, 7))}
          >
            Today
          </Button>

          <button onClick={fetchDashboardData} disabled={loading}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 ml-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "..." : "Refresh"}
          </button>
        </div>
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

      {/* Reminders & Quick Add */}
      <div className="grid gap-4 lg:grid-cols-3">
        {paymentReminders.length > 0 && (
          <Card className="lg:col-span-2 border-rose-200 bg-rose-50/20 dark:bg-rose-950/10">
            <CardHeader className="pb-2 flex flex-row items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              <CardTitle className="text-base text-rose-700 dark:text-rose-400">Payment Reminders</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 pt-2">
              {paymentReminders.map(rem => {
                 return (
                   <div key={rem.id} className="flex justify-between items-center p-3 rounded-lg border border-rose-100 dark:border-rose-900 bg-card shadow-sm">
                     <div>
                       <p className="font-bold text-sm">{rem.title}</p>
                       <p className={`text-[10px] uppercase font-bold ${rem.diffDays <= 1 ? "text-rose-600" : "text-amber-600"}`}>
                         {rem.diffDays === 0 ? "Due Today" : rem.diffDays === 1 ? "Due Tomorrow" : rem.diffDays < 0 ? "Overdue!" : `Due in ${rem.diffDays} days`}
                       </p>
                     </div>
                     <div className="text-right flex items-center justify-end gap-3 border-l border-border/50 pl-4 ml-2">
                       <div>
                         <p className="font-extrabold text-rose-600">৳{Number(rem.amount).toLocaleString()}</p>
                         <p className="text-[10px] text-muted-foreground">{rem.due_date}</p>
                       </div>
                       {rem.type === 'credit_bill' && (
                          <div className="flex pl-2 items-center">
                             <Button size="sm" onClick={() => handlePayCreditBill(rem)} disabled={payingBill === rem.id} className="h-7 text-xs px-2 shadow-sm font-bold">
                                {payingBill === rem.id ? '...' : 'Pay'}
                             </Button>
                          </div>
                       )}
                     </div>
                   </div>
                 );
              })}
            </CardContent>
          </Card>
        )}

        <Card className={`${paymentReminders.length === 0 ? 'lg:col-span-3' : 'lg:col-span-1'} border-primary/20 bg-primary/5`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="bg-primary text-primary-foreground p-1 rounded-md">
                <Activity className="h-3 w-3" />
              </div>
              Quick Add (Daily)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <input 
                type="number" placeholder="Amount (৳)" 
                className="w-full text-sm bg-background border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={quickAdd.amount}
                onChange={e => setQuickAdd({...quickAdd, amount: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <input 
                type="text" placeholder="Expense for..." 
                className="w-full text-sm bg-background border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={quickAdd.note}
                onChange={e => setQuickAdd({...quickAdd, note: e.target.value})}
              />
            </div>
            <div className="flex gap-1">
              <button 
                onClick={() => setQuickAdd({...quickAdd, payment_method: 'debit'})}
                className={`flex-1 text-[10px] font-bold py-1.5 rounded transition-colors border ${quickAdd.payment_method === 'debit' ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-muted-foreground border-border'}`}
              >DEBIT</button>
              <button 
                onClick={() => setQuickAdd({...quickAdd, payment_method: 'credit'})}
                className={`flex-1 text-[10px] font-bold py-1.5 rounded transition-colors border ${quickAdd.payment_method === 'credit' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-transparent text-muted-foreground border-border'}`}
              >CREDIT</button>
            </div>
            <Button className="w-full h-8 text-xs font-bold" onClick={handleQuickAdd} disabled={addingQuick || !quickAdd.amount || !quickAdd.note}>
              {addingQuick ? 'Saving...' : 'Add Now'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
