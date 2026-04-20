import { useState, useEffect, useCallback } from "react";
import {
  Pencil, Trash2, X, Check, RepeatIcon, ChevronLeft, ChevronRight,
  PiggyBank, Coffee, Home, Bus, Zap, Film, ShoppingCart, Plus, CheckCircle
} from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { getSupabaseBrowserClient } from "../lib/supabase/browser-client";
import { formatLocalDate } from "../lib/utils";


const CATEGORY_MAP = {
  Rent: { icon: Home, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30" },
  Bills: { icon: Zap, color: "text-yellow-500", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
  Transport: { icon: Bus, color: "text-orange-500", bg: "bg-orange-100 dark:bg-orange-900/30" },
  Entertainment: { icon: Film, color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-900/30" },
  Food: { icon: Coffee, color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  Shopping: { icon: ShoppingCart, color: "text-pink-500", bg: "bg-pink-100 dark:bg-pink-900/30" },
  EMI: { icon: RepeatIcon, color: "text-indigo-500", bg: "bg-indigo-100 dark:bg-indigo-900/30" },
  Other: { icon: ShoppingCart, color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-900/30" },
};
const getCategoryAssets = (cat) => CATEGORY_MAP[cat] || CATEGORY_MAP.Other;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function toYearMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function addMonths(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return toYearMonth(d);
}
// Count how many complete weeks (Mon–Sun) start within a given YYYY-MM
function weeksInMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  const days = new Date(y, m, 0).getDate(); // days in month
  return Math.floor(days / 7) + (days % 7 >= 1 ? 1 : 0); // ≈4 or 5
}
// Get the effective monthly contribution for a DPS goal
function dpsMonthlyAmount(goal, ym) {
  const base = Number(goal.monthly_amount || 0);
  if (goal.frequency === "weekly") return base * weeksInMonth(ym);
  return base;
}
function monthLabel(ym) {
  if (!ym) return "—";
  const [y, m] = ym.split("-");
  return `${MONTHS[parseInt(m) - 1]} ${y}`;
}

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


const INITIAL_REC_FORM = {
  name: "", category: "EMI", amount: "",
  start_date: formatLocalDate(), 
  end_date: formatLocalDate(new Date(new Date().setFullYear(new Date().getFullYear() + 1))),

  frequency: "monthly",
  payment_day: "1", // Date of month or Day of week (0-6)
  notes: "",
};

export function Expenses() {
  const [selectedMonth, setSelectedMonth] = useState(toYearMonth(new Date()));

  // EMI / Recurring
  const [recurring, setRecurring] = useState([]);
  const [loadingRec, setLoadingRec] = useState(true);
  const [savingRec, setSavingRec] = useState(false);
  const [recForm, setRecForm] = useState(INITIAL_REC_FORM);
  const [editingRecId, setEditingRecId] = useState(null);
  const [deleteRecConfirm, setDeleteRecConfirm] = useState(null);
  const [showRecForm, setShowRecForm] = useState(false);
  const [paidRecIds, setPaidRecIds] = useState(new Set());
  const [showPaid, setShowPaid] = useState(false);

  // Credit Bill
  const [creditBill, setCreditBill] = useState({ total: 0, isPaid: false });


  // DPS contributions from savings
  const [dpsSavings, setDpsSavings] = useState([]);
  const [loadingDps, setLoadingDps] = useState(true);

  const supabase = getSupabaseBrowserClient();

  const shiftMonth = (delta) => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(toYearMonth(d));
  };

  const fetchRecurring = useCallback(async () => {
    setLoadingRec(true);
    const { data, error } = await supabase
      .from("recurring_expenses").select("*").order("created_at", { ascending: true });
    if (error) console.error(error);
    else setRecurring(data || []);
    setLoadingRec(false);
  }, [supabase]);

  const fetchPaidPayments = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("recurring_payments")
      .select("recurring_expense_id")
      .eq("payment_month", selectedMonth)
      .eq("user_id", user.id);
    if (error) console.error(error);
    else setPaidRecIds(new Set(data.map(p => p.recurring_expense_id)));
  }, [supabase, selectedMonth]);


  const fetchDpsSavings = useCallback(async () => {
    setLoadingDps(true);
    const { data, error } = await supabase
      .from("savings_goals")
      .select("*")
      .eq("is_recurring", true);
    if (error) console.error(error);
    else setDpsSavings(data || []);
    setLoadingDps(false);
  }, []);

  const fetchCreditBill = useCallback(async () => {
    // Get month before selectedMonth
    const [y, m] = selectedMonth.split("-").map(Number);
    const lm = new Date(y, m - 2, 1); // m-2 because Date month is 0-indexed and we want month before
    const lmY = lm.getFullYear();
    const lmM = lm.getMonth();
    const lastMonthKey = `${lmY}-${String(lmM + 1).padStart(2, "0")}`;
    const lmStart = `${lastMonthKey}-01`;
    const lmEnd = new Date(lmY, lmM + 1, 0).toISOString().split('T')[0];

    const [
      { data: lmExp },
      { data: lmDaily },
      { data: lmDps },
      { data: lmLoanPay },
      { data: billsPaid }
    ] = await Promise.all([
      supabase.from("expenses").select("amount,payment_method").gte("date", lmStart).lte("date", lmEnd).eq("payment_method", 'credit'),
      supabase.from("daily_spends").select("amount,payment_method").gte("date", lmStart).lte("date", lmEnd).eq("payment_method", 'credit'),
      supabase.from("dps_payments").select("amount,paid_at,payment_method").eq("payment_method", 'credit'), // Filter below
      supabase.from("loan_payments").select("amount,paid_at,payment_method").eq("payment_method", 'credit'), // Filter below
      supabase.from("credit_bill_payments").select("*").eq("bill_month", lastMonthKey)
    ]);

    const totalExp = (lmExp || []).reduce((s, e) => s + Number(e.amount), 0);
    const totalDaily = (lmDaily || []).reduce((s, e) => s + Number(e.amount), 0);
    
    // Filter payments actually swiped last month
    const totalDps = (lmDps || []).filter(p => {
      const d = new Date(p.paid_at);
      return d.getFullYear() === lmY && d.getMonth() === lmM;
    }).reduce((s, e) => s + Number(e.amount), 0);

    const totalLoans = (lmLoanPay || []).filter(p => {
      const d = new Date(p.paid_at);
      return d.getFullYear() === lmY && d.getMonth() === lmM;
    }).reduce((s, e) => s + Number(e.amount), 0);

    setCreditBill({
      total: totalExp + totalDaily + totalDps + totalLoans,
      isPaid: (billsPaid || []).length > 0
    });
  }, [selectedMonth, supabase]);

  useEffect(() => { 
    fetchRecurring(); 
    fetchDpsSavings(); 
    fetchPaidPayments();
    fetchCreditBill();
  }, [fetchRecurring, fetchDpsSavings, fetchPaidPayments, fetchCreditBill]);


  // Filter EMI entries active this month
  const activeEmi = recurring.filter(r => {
    // If we have the new date fields
    if (r.start_date) {
      const monthStart = `${selectedMonth}-01`;
      const monthEnd = new Date(selectedMonth.split("-")[0], selectedMonth.split("-")[1], 0).getDate();
      const monthEndStr = `${selectedMonth}-${String(monthEnd).padStart(2, "0")}`;
      
      const isStarted = r.start_date <= monthEndStr;
      const isNotEnded = !r.end_date || r.end_date >= monthStart;
      return isStarted && isNotEnded;
    }
    // Fallback to old month-based columns if start_date is missing
    if (r.start_month) {
      return r.start_month <= selectedMonth && (!r.end_month || r.end_month >= selectedMonth);
    }
    return false;
  });


  // Filter DPS savings active this month
  const activeDps = dpsSavings.filter(g => {
    // Priority 1: Use new start_date and mature_date
    if (g.start_date) {
      const monthStart = `${selectedMonth}-01`;
      const lastDay = new Date(selectedMonth.split("-")[0], selectedMonth.split("-")[1], 0).getDate();
      const monthEndStr = `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;
      
      const isStarted = g.start_date <= monthEndStr;
      const isNotEnded = !g.mature_date || g.mature_date >= monthStart;
      return isStarted && isNotEnded;
    }
    // Priority 2: Fallback to legacy month-based columns
    if (g.start_month && g.duration_months) {
      const endMonth = addMonths(g.start_month, g.duration_months - 1);
      return g.start_month <= selectedMonth && endMonth >= selectedMonth;
    }
    return false;
  });


  // ---- Save EMI ----
  const handleSaveRec = async () => {
    if (!recForm.name.trim() || !recForm.amount) return;
    setSavingRec(true);
    if (editingRecId) {
      await supabase.from("recurring_expenses").update({
        name: recForm.name, category: recForm.category, amount: Number(recForm.amount),
        start_date: recForm.start_date, end_date: recForm.end_date, 
        frequency: recForm.frequency, payment_day: parseInt(recForm.payment_day),
        notes: recForm.notes,
      }).eq("id", editingRecId);
    } else {
      await supabase.from("recurring_expenses").insert([{
        name: recForm.name, category: recForm.category, amount: Number(recForm.amount),
        start_date: recForm.start_date, end_date: recForm.end_date,
        frequency: recForm.frequency, payment_day: parseInt(recForm.payment_day),
        notes: recForm.notes,
      }]);
    }
    setRecForm(INITIAL_REC_FORM);
    setEditingRecId(null);
    setSavingRec(false);
    setShowRecForm(false);
    fetchRecurring();
  };

  const handleEditRec = (rec) => {
    setEditingRecId(rec.id);
    setRecForm({ 
      name: rec.name, 
      category: rec.category, 
      amount: String(rec.amount), 
      start_date: rec.start_date, 
      end_date: rec.end_date, 
      frequency: rec.frequency || "monthly",
      payment_day: String(rec.payment_day ?? 1),
      notes: rec.notes || "" 
    });
    setShowRecForm(true);
  };

  const handleDeleteRec = async (id) => {
    await supabase.from("recurring_expenses").delete().eq("id", id);
    setDeleteRecConfirm(null);
    fetchRecurring();
  };

  const handleTogglePaid = async (recId, currentlyPaid) => {
    // Check if it's the credit bill
    if (recId === 'credit_bill_VIRTUAL') {
      if (currentlyPaid) return; // Cannot "unpay" a credit bill from here easily
      
      const [y, m] = selectedMonth.split("-").map(Number);
      const lm = new Date(y, m - 2, 1);
      const lastMonthKey = `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, "0")}`;
      
      const { error } = await supabase.from("credit_bill_payments").insert([{
        bill_month: lastMonthKey,
        amount: creditBill.total
      }]);
      
      if (!error) fetchCreditBill();
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (currentlyPaid) {
      await supabase.from("recurring_payments")
        .delete()
        .eq("recurring_expense_id", recId)
        .eq("payment_month", selectedMonth);
    } else {
      await supabase.from("recurring_payments").insert([{
        recurring_expense_id: recId,
        payment_month: selectedMonth,
        user_id: user.id
      }]);
    }
    fetchPaidPayments();
  };


  const emiTotal = activeEmi.reduce((s, r) => {
    const base = Number(r.amount);
    if (r.frequency === "weekly") {
      return s + (base * countOccurrences(selectedMonth, r.payment_day));
    }
    return s + base;
  }, 0);
  const dpsTotal = activeDps.reduce((s, g) => s + dpsMonthlyAmount(g, selectedMonth), 0);
  const creditTotalToAdd = (!creditBill.isPaid && creditBill.total > 0) ? creditBill.total : 0;
  const grandTotal = emiTotal + dpsTotal + creditTotalToAdd;

  const selectClass = "flex h-10 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

  const DeleteBtns = ({ id, onConfirm, confirmState, setConfirmState }) => (
    deleteRecConfirm === id ? (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => onConfirm(id)}><Check className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteRecConfirm(null)}><X className="h-3.5 w-3.5" /></Button>
      </div>
    ) : (
      <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-rose-500" onClick={() => setDeleteRecConfirm(id)}><Trash2 className="h-3.5 w-3.5" /></Button>
    )
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Recurring Expenses</h1>
          <p className="text-sm sm:text-base text-muted-foreground">EMI, rent, subscriptions, and savings contributions — auto-tracked every month.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-2 py-1.5">
            <button onClick={() => shiftMonth(-1)} className="p-1 rounded hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm font-semibold w-24 text-center">{monthLabel(selectedMonth)}</span>
            <button onClick={() => shiftMonth(1)} className="p-1 rounded hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <Button onClick={() => { setShowRecForm(true); setEditingRecId(null); setRecForm(INITIAL_REC_FORM); }}>
            <Plus className="mr-2 h-4 w-4" /> Add EMI
          </Button>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg px-4 py-3">
          <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">EMI / Recurring</p>
          <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300">৳{emiTotal.toLocaleString()}</p>
          <p className="text-xs text-indigo-500 mt-0.5">{activeEmi.length} active items</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg px-4 py-3">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Savings Contributions (DPS)</p>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">৳{dpsTotal.toLocaleString()}</p>
          <p className="text-xs text-emerald-500 mt-0.5">{activeDps.length} active plans</p>
        </div>
        <div className="bg-card border border-primary/30 rounded-lg px-4 py-3">
          <p className="text-xs text-muted-foreground font-medium">Total Committed</p>
          <p className="text-xl font-bold">৳{grandTotal.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-0.5">for {monthLabel(selectedMonth)}</p>
        </div>
      </div>

      {/* EMI Add/Edit Form */}
      {showRecForm && (
        <Card className="border-indigo-200 dark:border-indigo-800">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RepeatIcon className="h-4 w-4 text-indigo-500" />
              {editingRecId ? "Edit EMI / Recurring" : "New EMI / Recurring Expense"}
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setShowRecForm(false); setEditingRecId(null); setRecForm(INITIAL_REC_FORM); }}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5 lg:col-span-2">
                <label className="text-sm font-medium">Name / Label</label>
                <Input placeholder="e.g. Phone EMI, Netflix" value={recForm.name} onChange={e => setRecForm({ ...recForm, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Category</label>
                <select value={recForm.category} onChange={e => setRecForm({ ...recForm, category: e.target.value })} className={selectClass}>
                  {Object.keys(CATEGORY_MAP).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Monthly Amount (৳)</label>
                <Input type="number" placeholder="e.g. 3000" value={recForm.amount} onChange={e => setRecForm({ ...recForm, amount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Frequency</label>
                <select value={recForm.frequency} onChange={e => setRecForm({ ...recForm, frequency: e.target.value, payment_day: e.target.value === 'weekly' ? '1' : '1' })} className={selectClass}>
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{recForm.frequency === 'weekly' ? "Payment Day" : "Day of Month"}</label>
                <select value={recForm.payment_day} onChange={e => setRecForm({ ...recForm, payment_day: e.target.value })} className={selectClass}>
                  {recForm.frequency === 'weekly' ? (
                    ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((day, idx) => <option key={day} value={idx}>{day}</option>)
                  ) : (
                    Array.from({length: 31}, (_, i) => <option key={i+1} value={i+1}>{i+1}</option>)
                  )}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Start Date</label>
                <Input type="date" value={recForm.start_date} onChange={e => setRecForm({ ...recForm, start_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">End Date</label>
                <Input type="date" value={recForm.end_date} onChange={e => setRecForm({ ...recForm, end_date: e.target.value })} />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-medium">Notes (Optional)</label>
                <Input placeholder="e.g. Samsung Galaxy S24 Ultra" value={recForm.notes} onChange={e => setRecForm({ ...recForm, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSaveRec} disabled={savingRec || !recForm.name || !recForm.amount}>
                {savingRec ? "Saving..." : editingRecId ? "Update" : "Add Recurring"}
              </Button>
              <Button variant="outline" onClick={() => { setShowRecForm(false); setEditingRecId(null); setRecForm(INITIAL_REC_FORM); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* EMI / Recurring section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <RepeatIcon className="h-5 w-5 text-indigo-500" /> EMI & Recurring Bills
              </h2>
              <button 
                onClick={() => setShowPaid(!showPaid)}
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full transition-colors ${
                  showPaid ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {showPaid ? "Showing Paid" : "Hide Paid"}
              </button>
            </div>
            <span className="text-sm text-muted-foreground">{(activeEmi.length + (creditBill.total > 0 ? 1 : 0))} active in {monthLabel(selectedMonth)}</span>
          </div>


          {/* Active this month */}
          {loadingRec ? (
            <p className="text-muted-foreground text-center py-6">Loading...</p>
          ) : (activeEmi.length === 0 && creditBill.total === 0) ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <RepeatIcon className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No recurring expenses or credit bills for {monthLabel(selectedMonth)}.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowRecForm(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add one
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {/* Virtual Credit Bill Item */}
              {creditBill.total > 0 && (showPaid || !creditBill.isPaid) && (
                <div className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  creditBill.isPaid 
                    ? "border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-950/10 opacity-75" 
                    : "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-sm"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${creditBill.isPaid ? "bg-emerald-100 text-emerald-600" : "bg-indigo-600 text-white"}`}>
                      <ShoppingCart className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className={`font-bold text-sm ${creditBill.isPaid ? "line-through text-muted-foreground" : ""}`}>Credit Card Bill ({MONTHS[new Date(selectedMonth.split("-")[0], selectedMonth.split("-")[1] - 2).getMonth()]})</p>
                        {creditBill.isPaid && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase">Settled</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">Aggregated from previous month's credit swipes</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span className={`font-extrabold text-sm block ${creditBill.isPaid ? "text-muted-foreground line-through" : "text-indigo-600 dark:text-indigo-400"}`}>
                      - ৳{creditBill.total.toLocaleString()}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={`h-8 px-2 gap-1.5 ${creditBill.isPaid ? "text-emerald-600" : "text-indigo-600 hover:text-indigo-700"}`}
                      onClick={() => handleTogglePaid('credit_bill_VIRTUAL', creditBill.isPaid)}
                      disabled={creditBill.isPaid}
                    >
                      <CheckCircle className={`h-4 w-4 ${creditBill.isPaid ? "fill-emerald-100" : ""}`} />
                      <span className="text-xs font-bold">{creditBill.isPaid ? "Settled" : "Settle Bill"}</span>
                    </Button>
                  </div>
                </div>
              )}

              {activeEmi
                .filter(rec => showPaid || !paidRecIds.has(rec.id))
                .map(rec => {
                const { icon: Icon, color, bg } = getCategoryAssets(rec.category);
                const isPaid = paidRecIds.has(rec.id);
                return (
                  <div key={rec.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                    isPaid 
                      ? "border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-950/10 opacity-75" 
                      : "border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/20"
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isPaid ? "bg-emerald-100 text-emerald-600" : `${bg} ${color}`}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`font-medium text-sm ${isPaid ? "line-through text-muted-foreground" : ""}`}>{rec.name}</p>
                          {isPaid && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase">Paid</span>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {rec.category} • {rec.start_date} → {rec.end_date}
                          <br />
                          {rec.frequency === 'weekly' 
                            ? `Every ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][rec.payment_day]}`
                            : `Day ${rec.payment_day} of month`
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <div>
                        <span className={`font-bold text-sm block ${isPaid ? "text-muted-foreground line-through" : "text-indigo-600 dark:text-indigo-400"}`}>
                          - ৳{Number(rec.amount).toLocaleString()}/{rec.frequency === 'weekly' ? 'wk' : 'mo'}
                        </span>
                        {rec.frequency === 'weekly' && !isPaid && (
                          <span className="text-[10px] text-muted-foreground block">
                            (Total: ৳{(Number(rec.amount) * countOccurrences(selectedMonth, rec.payment_day)).toLocaleString()} this month)
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 ml-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className={`h-8 px-2 gap-1.5 ${isPaid ? "text-emerald-600 hover:text-emerald-700" : "text-slate-500 hover:text-indigo-600"}`}
                          onClick={() => handleTogglePaid(rec.id, isPaid)}
                        >
                          <CheckCircle className={`h-4 w-4 ${isPaid ? "fill-emerald-100" : ""}`} />
                          <span className="text-xs font-semibold">{isPaid ? "Paid" : "Pay"}</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-blue-500" onClick={() => handleEditRec(rec)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <DeleteBtns id={rec.id} onConfirm={handleDeleteRec} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}


          {/* All recurring (collapsed view) */}
          {recurring.length > activeEmi.length && (
            <details className="mt-2">
              <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
                View all {recurring.length} recurring entries
              </summary>
              <div className="space-y-2 mt-3">
                {recurring.filter(r => !activeEmi.find(a => a.id === r.id)).map(rec => (
                  <div key={rec.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border opacity-50 text-sm">
                    <div>
                      <span className="font-medium">{rec.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({rec.start_date ? rec.start_date.slice(0, 7) : monthLabel(rec.start_month)} – {rec.end_date ? rec.end_date.slice(0,7) : monthLabel(rec.end_month)})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">৳{Number(rec.amount).toLocaleString()}/mo</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-blue-500" onClick={() => handleEditRec(rec)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <DeleteBtns id={rec.id} onConfirm={handleDeleteRec} />
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* DPS / Savings Contribution section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <PiggyBank className="h-5 w-5 text-emerald-500" /> Savings Contributions (DPS)
            </h2>
            <span className="text-sm text-muted-foreground">{activeDps.length} active in {monthLabel(selectedMonth)}</span>
          </div>

          {loadingDps ? (
            <p className="text-muted-foreground text-center py-6">Loading...</p>
          ) : activeDps.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <PiggyBank className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No DPS active for {monthLabel(selectedMonth)}.</p>
                <p className="text-xs text-muted-foreground mt-1">Create a recurring savings goal in the Savings page.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeDps.map(goal => {
                const endMonth = goal.start_month ? addMonths(goal.start_month, (goal.duration_months || 1) - 1) : "—";
                const monthsElapsed = goal.start_month ? (
                  (() => {
                    const [sy, sm] = goal.start_month.split("-").map(Number);
                    const [cy, cm] = selectedMonth.split("-").map(Number);
                    return (cy - sy) * 12 + (cm - sm) + 1;
                  })()
                ) : 0;
                const progress = Math.min(Math.round((monthsElapsed / (goal.duration_months || 1)) * 100), 100);

                return (
                  <div key={goal.id} className="flex items-center justify-between p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">
                        <PiggyBank className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{goal.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {goal.start_month ? monthLabel(goal.start_month) : "?"} → {endMonth !== "—" ? monthLabel(endMonth) : "—"} • Month {monthsElapsed}/{goal.duration_months}
                        </p>
                        <div className="mt-1 h-1.5 w-32 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    </div>
                    <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                      {goal.frequency === "weekly"
                        ? `- ৳${Number(goal.monthly_amount || 0).toLocaleString()}/wk (৳${dpsMonthlyAmount(goal, selectedMonth).toLocaleString()}/mo)`
                        : `- ৳${Number(goal.monthly_amount || 0).toLocaleString()}/mo`
                      }
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* All DPS (inactive) */}
          {dpsSavings.length > activeDps.length && (
            <details className="mt-2">
              <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
                View all {dpsSavings.length} savings plans
              </summary>
              <div className="space-y-2 mt-3">
                {dpsSavings.filter(g => !activeDps.find(a => a.id === g.id)).map(goal => {
                  const endMonth = goal.start_month ? addMonths(goal.start_month, (goal.duration_months || 1) - 1) : "—";
                  return (
                    <div key={goal.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border opacity-50 text-sm">
                      <div>
                        <span className="font-medium">{goal.name}</span>
                        {goal.start_month && <span className="text-xs text-muted-foreground ml-2">({monthLabel(goal.start_month)} – {endMonth !== "—" ? monthLabel(endMonth) : "?"})</span>}
                      </div>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {goal.frequency === "weekly"
                          ? `৳${Number(goal.monthly_amount || 0).toLocaleString()}/wk`
                          : `৳${Number(goal.monthly_amount || 0).toLocaleString()}/mo`
                        }
                      </span>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
