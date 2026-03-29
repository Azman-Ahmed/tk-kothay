import { useState, useEffect, useCallback } from "react";
import {
  Pencil, Trash2, X, Check, RepeatIcon, ChevronLeft, ChevronRight,
  PiggyBank, Coffee, Home, Bus, Zap, Film, ShoppingCart, Plus
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { getSupabaseBrowserClient } from "../lib/supabase/browser-client";

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
  const [y, m] = ym.split("-");
  return `${MONTHS[parseInt(m) - 1]} ${y}`;
}

const INITIAL_REC_FORM = {
  name: "", category: "EMI", amount: "",
  start_month: toYearMonth(new Date()), end_month: toYearMonth(new Date()), notes: "",
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
  }, []);

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

  useEffect(() => { fetchRecurring(); fetchDpsSavings(); }, [fetchRecurring, fetchDpsSavings]);

  // Filter EMI entries active this month
  const activeEmi = recurring.filter(r => r.start_month <= selectedMonth && r.end_month >= selectedMonth);

  // Filter DPS savings active this month
  const activeDps = dpsSavings.filter(g => {
    if (!g.start_month || !g.duration_months) return false;
    const endMonth = addMonths(g.start_month, g.duration_months - 1);
    return g.start_month <= selectedMonth && endMonth >= selectedMonth;
  });

  // ---- Save EMI ----
  const handleSaveRec = async () => {
    if (!recForm.name.trim() || !recForm.amount) return;
    setSavingRec(true);
    if (editingRecId) {
      await supabase.from("recurring_expenses").update({
        name: recForm.name, category: recForm.category, amount: Number(recForm.amount),
        start_month: recForm.start_month, end_month: recForm.end_month, notes: recForm.notes,
      }).eq("id", editingRecId);
    } else {
      await supabase.from("recurring_expenses").insert([{
        name: recForm.name, category: recForm.category, amount: Number(recForm.amount),
        start_month: recForm.start_month, end_month: recForm.end_month, notes: recForm.notes,
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
    setRecForm({ name: rec.name, category: rec.category, amount: String(rec.amount), start_month: rec.start_month, end_month: rec.end_month, notes: rec.notes || "" });
    setShowRecForm(true);
  };

  const handleDeleteRec = async (id) => {
    await supabase.from("recurring_expenses").delete().eq("id", id);
    setDeleteRecConfirm(null);
    fetchRecurring();
  };

  const emiTotal = activeEmi.reduce((s, r) => s + Number(r.amount), 0);
  const dpsTotal = activeDps.reduce((s, g) => s + dpsMonthlyAmount(g, selectedMonth), 0);
  const grandTotal = emiTotal + dpsTotal;

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
          <h1 className="text-3xl font-bold tracking-tight">Recurring Expenses</h1>
          <p className="text-muted-foreground">EMI, rent, subscriptions, and savings contributions — auto-tracked every month.</p>
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
                <label className="text-sm font-medium">Start Month</label>
                <Input type="month" value={recForm.start_month} onChange={e => setRecForm({ ...recForm, start_month: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">End Month</label>
                <Input type="month" value={recForm.end_month} onChange={e => setRecForm({ ...recForm, end_month: e.target.value })} />
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
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <RepeatIcon className="h-5 w-5 text-indigo-500" /> EMI & Recurring Bills
            </h2>
            <span className="text-sm text-muted-foreground">{activeEmi.length} active in {monthLabel(selectedMonth)}</span>
          </div>

          {/* Active this month */}
          {loadingRec ? (
            <p className="text-muted-foreground text-center py-6">Loading...</p>
          ) : activeEmi.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <RepeatIcon className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No recurring expenses for {monthLabel(selectedMonth)}.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowRecForm(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add one
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeEmi.map(rec => {
                const { icon: Icon, color, bg } = getCategoryAssets(rec.category);
                return (
                  <div key={rec.id} className="flex items-center justify-between p-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/20">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${bg} ${color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{rec.name}</p>
                        <p className="text-xs text-muted-foreground">{rec.category} • {monthLabel(rec.start_month)} → {monthLabel(rec.end_month)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-indigo-600 dark:text-indigo-400">- ৳{Number(rec.amount).toLocaleString()}/mo</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-blue-500" onClick={() => handleEditRec(rec)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <DeleteBtns id={rec.id} onConfirm={handleDeleteRec} />
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
                {recurring.filter(r => !(r.start_month <= selectedMonth && r.end_month >= selectedMonth)).map(rec => (
                  <div key={rec.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border opacity-50 text-sm">
                    <div>
                      <span className="font-medium">{rec.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">({monthLabel(rec.start_month)} – {monthLabel(rec.end_month)})</span>
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
