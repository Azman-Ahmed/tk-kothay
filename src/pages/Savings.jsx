import { useState, useEffect, useCallback } from "react";
import { Plus, Target, CheckCircle2, Pencil, Trash2, X, Check, RepeatIcon, PiggyBank } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { getSupabaseBrowserClient } from "../lib/supabase/browser-client";
import { formatLocalDate, generateDPSSchedule } from "../lib/utils";


const GOAL_COLORS = [
  { label: "Blue",   value: "bg-blue-500" },
  { label: "Emerald",value: "bg-emerald-500" },
  { label: "Amber",  value: "bg-amber-500" },
  { label: "Rose",   value: "bg-rose-500" },
  { label: "Purple", value: "bg-purple-500" },
  { label: "Indigo", value: "bg-indigo-500" },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function toYearMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(ym) {
  if (!ym) return "—";
  const [y, m] = ym.split("-");
  return `${MONTHS[parseInt(m) - 1]} ${y}`;
}

const INITIAL_FORM = {
  name: "", current_amount: "", target_amount: "", color: "bg-blue-500",
  is_recurring: false, frequency: "monthly", monthly_amount: "", 
  start_date: formatLocalDate(), 
  mature_date: formatLocalDate(new Date(new Date().setFullYear(new Date().getFullYear() + 1))), 
  duration_months: "12",
  cleared_till_date: "",
};

const INITIAL_FUND_FORM = { amount: "" };

export function Savings() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [addFundsGoal, setAddFundsGoal] = useState(null);
  const [scheduleViewGoal, setScheduleViewGoal] = useState(null);
  const [payingId, setPayingId] = useState(null);
  const [fundForm, setFundForm] = useState(INITIAL_FUND_FORM);
  const [activeTab, setActiveTab] = useState("all"); // "all" | "regular" | "dps"
  const [dpsPayments, setDpsPayments] = useState([]);

  const supabase = getSupabaseBrowserClient();

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    const [{ data: goalsData, error }, { data: paymentsData, error: paymentsError }] = await Promise.all([
      supabase.from("savings_goals").select("*").order("created_at", { ascending: true }),
      supabase.from("dps_payments").select("*")
    ]);
    if (error) console.error(error);
    if (paymentsError) {
       console.error("DPS Payments Fetch Error:", paymentsError);
    } else {
      setGoals(goalsData || []);
      setDpsPayments(paymentsData || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.target_amount) return;
    setSaving(true);
    const payload = {
      name: form.name,
      current_amount: Number(form.current_amount) || 0,
      target_amount: Number(form.target_amount),
      color: form.color,
      is_recurring: form.is_recurring,
      frequency: form.is_recurring ? form.frequency : 'monthly',
      monthly_amount: form.is_recurring ? Number(form.monthly_amount) || 0 : 0,
      start_date: form.is_recurring ? form.start_date : null,
      mature_date: form.is_recurring ? form.mature_date : null,
      start_month: form.is_recurring ? form.start_date.slice(0, 7) : null,
      duration_months: form.is_recurring ? Number(form.duration_months) || null : null,
    };

    if (editingId) {
      await supabase.from("savings_goals").update(payload).eq("id", editingId);
    } else {
      const { data: newGoalData, error } = await supabase.from("savings_goals").insert([payload]).select();
      if (!error && newGoalData?.[0] && payload.is_recurring && form.cleared_till_date) {
        const newGoal = newGoalData[0];
        const scheduleToClear = generateDPSSchedule(newGoal, []).filter(inst => inst.due_date <= form.cleared_till_date);
        const inserts = scheduleToClear.map(inst => ({
           savings_goal_id: newGoal.id,
           due_date: inst.due_date,
           amount: inst.amount
        }));
        if (inserts.length > 0) {
           const { error: insertError } = await supabase.from("dps_payments").insert(inserts);
           if (insertError) console.error("Error inserting past installments:", insertError);
        }
      }
    }
    setForm(INITIAL_FORM);
    setEditingId(null);
    setShowForm(false);
    setSaving(false);
    fetchGoals();
  };

  const handleEdit = (goal) => {
    setEditingId(goal.id);
    setForm({
      name: goal.name,
      current_amount: String(goal.current_amount),
      target_amount: String(goal.target_amount),
      color: goal.color || "bg-blue-500",
      is_recurring: !!goal.is_recurring,
      frequency: goal.frequency || "monthly",
      monthly_amount: String(goal.monthly_amount || ""),
      start_date: goal.start_date || (goal.start_month ? goal.start_month + "-01" : formatLocalDate()),
      mature_date: goal.mature_date || formatLocalDate(),
      duration_months: String(goal.duration_months || ""),
      cleared_till_date: "",
    });

    setShowForm(true);
    setAddFundsGoal(null);
    setScheduleViewGoal(null);
  };

  const handleDelete = async (id) => {
    await supabase.from("savings_goals").delete().eq("id", id);
    setDeleteConfirm(null);
    fetchGoals();
  };

  const handleAddFunds = async () => {
    if (!fundForm.amount || isNaN(fundForm.amount)) return;
    const goal = goals.find(g => g.id === addFundsGoal);
    if (!goal) return;
    const newAmount = Math.min(Number(goal.current_amount) + Number(fundForm.amount), Number(goal.target_amount));
    await supabase.from("savings_goals").update({ current_amount: newAmount }).eq("id", addFundsGoal);
    setAddFundsGoal(null);
    setFundForm(INITIAL_FUND_FORM);
    fetchGoals();
  };

  const handlePayInstallment = async (goal, installment) => {
    setSaving(true);
    setPayingId(installment.due_date);
    const { error } = await supabase.from("dps_payments").insert([{
       savings_goal_id: goal.id,
       due_date: installment.due_date,
       amount: installment.amount
    }]);
    
    if (error) {
       console.error("Payment Error:", error);
       alert("Could not process payment. Did you update the database schema?");
       setSaving(false);
       setPayingId(null);
       return;
    }
    
    // Also update current_amount of the goal
    const newAmount = Number(goal.current_amount) + Number(installment.amount);
    await supabase.from("savings_goals").update({ current_amount: newAmount }).eq("id", goal.id);
    
    setSaving(false);
    await fetchGoals();
    setPayingId(null);
  };

  const handleCancel = () => { setForm(INITIAL_FORM); setEditingId(null); setShowForm(false); };

  const regularGoals = goals.filter(g => !g.is_recurring);
  const dpsGoals = goals.filter(g => g.is_recurring);

  const displayGoals = activeTab === "regular" ? regularGoals
    : activeTab === "dps" ? dpsGoals
    : goals;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Savings Goals</h1>
          <p className="text-muted-foreground">Set targets and track your progress. Manage precise DPS installments easily.</p>
        </div>
        <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(INITIAL_FORM); setAddFundsGoal(null); setScheduleViewGoal(null); }}>
          <Plus className="mr-2 h-4 w-4" /> New Goal
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-primary/30 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>{editingId ? "Edit Goal" : "Create New Savings Goal"}</CardTitle>
            <Button variant="ghost" size="icon" onClick={handleCancel}><X className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recurring toggle */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
              <button
                onClick={() => setForm({ ...form, is_recurring: false })}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${!form.is_recurring ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <Target className="h-4 w-4" /> Regular Goal
              </button>
              <button
                onClick={() => setForm({ ...form, is_recurring: true })}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${form.is_recurring ? "bg-card shadow text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground"}`}>
                <RepeatIcon className="h-4 w-4" /> DPS / Recurring
              </button>
            </div>

            {form.is_recurring && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-400">
                💡 This will automatically appear as a deduction in <strong>Recurring Expenses</strong> every month for the duration you set.
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5 lg:col-span-2">
                <label className="text-sm font-medium">Goal Name</label>
                <Input placeholder={form.is_recurring ? "e.g. Monthly DPS, Emergency Fund SB" : "e.g. Emergency Fund"} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Target Amount (৳)</label>
                <Input type="number" placeholder="e.g. 60000" value={form.target_amount} onChange={e => setForm({ ...form, target_amount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Current Saved (৳)</label>
                <Input type="number" placeholder="e.g. 0" value={form.current_amount} onChange={e => setForm({ ...form, current_amount: e.target.value })} />
              </div>

              {/* Recurring-only fields */}
              {form.is_recurring && (
                <>
                  {/* Frequency toggle */}
                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                    <label className="text-sm font-medium">Deposit Frequency</label>
                    <div className="flex rounded-lg border border-border overflow-hidden">
                      <button type="button"
                        onClick={() => setForm({ ...form, frequency: "monthly" })}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                          form.frequency === "monthly" ? "bg-emerald-500 text-white" : "bg-card hover:bg-muted text-muted-foreground"
                        }`}>
                        Monthly
                      </button>
                      <button type="button"
                        onClick={() => setForm({ ...form, frequency: "weekly" })}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                          form.frequency === "weekly" ? "bg-emerald-500 text-white" : "bg-card hover:bg-muted text-muted-foreground"
                        }`}>
                        Weekly
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      {form.frequency === "weekly" ? "Weekly" : "Monthly"} Deposit (৳)
                    </label>
                    <Input type="number"
                      placeholder={form.frequency === "weekly" ? "e.g. 1000 per week" : "e.g. 5000 per month"}
                      value={form.monthly_amount}
                      onChange={e => setForm({ ...form, monthly_amount: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Start Date</label>
                    <Input type="date" value={form.start_date} 
                      onChange={e => {
                        const newStart = e.target.value;
                        const dur = parseInt(form.duration_months) || 0;
                        const [y, m, d] = newStart.split("-").map(Number);
                        const mature = new Date(y, m - 1 + dur, d);
                        setForm({ ...form, start_date: newStart, mature_date: formatLocalDate(mature) });
                      }} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Duration (months)</label>
                    <Input type="number" placeholder="e.g. 12" value={form.duration_months} 
                      onChange={e => {
                        const newDur = e.target.value;
                        const durInt = parseInt(newDur) || 0;
                        const [y, m, d] = form.start_date.split("-").map(Number);
                        const mature = new Date(y, m - 1 + durInt, d);
                        setForm({ ...form, duration_months: newDur, mature_date: formatLocalDate(mature) });
                      }} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-rose-500 font-bold">Maturity Date</label>
                    <Input type="date" value={form.mature_date} 
                      onChange={e => setForm({ ...form, mature_date: e.target.value })} />
                  </div>
                  {!editingId && (
                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-4 mt-2">
                       <label className="text-sm font-medium text-blue-600 dark:text-blue-400">Past Installments Cleared Till (Optional)</label>
                       <div className="text-xs text-muted-foreground mb-1">If you already paid past installments, select the date up to which you cleared them. We will mark them as paid automatically.</div>
                       <Input type="date" value={form.cleared_till_date} 
                         onChange={e => setForm({ ...form, cleared_till_date: e.target.value })} />
                    </div>
                  )}
                </>
              )}


              <div className={`space-y-1.5 ${form.is_recurring ? "sm:col-span-1" : "sm:col-span-2 lg:col-span-4"}`}>
                <label className="text-sm font-medium">Progress Bar Color</label>
                <div className="flex gap-2 pt-1">
                  {GOAL_COLORS.map(c => (
                    <button key={c.value} onClick={() => setForm({ ...form, color: c.value })}
                      className={`h-6 w-6 rounded-full ${c.value} transition-transform ${form.color === c.value ? "scale-125 ring-2 ring-offset-2 ring-foreground" : ""}`}
                      title={c.label} />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSave} disabled={saving || !form.name || !form.target_amount}>
                {saving ? "Saving..." : editingId ? "Update Goal" : "Create Goal"}
              </Button>
              <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border gap-1">
        {[
          { id: "all", label: `All (${goals.length})` },
          { id: "regular", label: `🎯 Goals (${regularGoals.length})` },
          { id: "dps", label: `🔄 DPS / Recurring (${dpsGoals.length})` },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Goals Grid */}
      {loading ? (
        <p className="text-muted-foreground text-center py-12">Loading goals...</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {displayGoals.map(goal => {
            const progress = Math.min(Math.round((Number(goal.current_amount) / Number(goal.target_amount)) * 100), 100);
            const isCompleted = progress >= 100;
            const remaining = Number(goal.target_amount) - Number(goal.current_amount);

            return (
              <Card key={goal.id} className={`flex flex-col ${isCompleted ? "border-emerald-500" : ""} ${goal.is_recurring ? "border-l-4 border-l-emerald-400" : ""}`}>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {goal.is_recurring ? <RepeatIcon className="h-4 w-4 text-emerald-500 shrink-0" /> : <Target className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <span className="truncate">{goal.name}</span>
                  </CardTitle>
                  <div className="flex items-center gap-1 shrink-0">
                    {isCompleted && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-blue-500" onClick={() => handleEdit(goal)}><Pencil className="h-3.5 w-3.5" /></Button>
                    {deleteConfirm === goal.id ? (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => handleDelete(goal.id)}><Check className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteConfirm(null)}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-rose-500" onClick={() => setDeleteConfirm(goal.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  {scheduleViewGoal === goal.id ? (
                    <div className="space-y-3 h-[200px] overflow-y-auto pr-1 text-sm custom-scrollbar bg-muted/20 p-2 rounded-md border">
                      <div className="flex items-center justify-between font-bold text-xs sticky top-0 bg-card/95 backdrop-blur z-10 pb-2 border-b">
                        <span>Due Date</span>
                        <span>Amount</span>
                        <span>Status</span>
                      </div>
                      {generateDPSSchedule(goal, dpsPayments.filter(p => p.savings_goal_id === goal.id)).map(inst => (
                         <div key={inst.due_date} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 text-xs">
                           <span className={inst.status === 'missed' ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''}>{inst.due_date}</span>
                           <span>৳{inst.amount}</span>
                           {inst.status === "paid" || payingId === inst.due_date ? (
                              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium"><CheckCircle2 className="h-3.5 w-3.5"/> Paid</span>
                           ) : (
                              <Button size="sm" variant={inst.status === 'missed' ? 'destructive' : 'outline'} className="h-6 px-2.5 text-[10px]" 
                                onClick={() => handlePayInstallment(goal, inst)} disabled={saving}>{payingId === inst.due_date ? "..." : "Pay"}</Button>
                           )}
                         </div>
                      ))}
                      {generateDPSSchedule(goal, dpsPayments.filter(p => p.savings_goal_id === goal.id)).length === 0 && (
                        <div className="py-4 text-center text-muted-foreground text-xs">No schedule found. Ensure start date and duration are set.</div>
                      )}
                      <Button variant="outline" size="sm" className="w-full mt-2 h-7 text-xs" onClick={() => setScheduleViewGoal(null)}>Close Schedule</Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-end">
                        <span className="text-2xl font-bold">৳{Number(goal.current_amount).toLocaleString()}</span>
                        <span className="text-sm text-muted-foreground mb-1">/ ৳{Number(goal.target_amount).toLocaleString()}</span>
                      </div>

                  <div className="space-y-1">
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full ${goal.color || "bg-blue-500"} transition-all duration-500`} style={{ width: `${progress}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground font-medium">
                      <span>{progress}%</span>
                      <span>{isCompleted ? "🎉 Completed!" : `৳${remaining.toLocaleString()} left`}</span>
                    </div>
                  </div>

                  {/* DPS info badge */}
                  {goal.is_recurring && goal.start_date && (
                    <div className="flex flex-col gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-md px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <RepeatIcon className="h-3 w-3 shrink-0" />
                        <span className="font-semibold">৳{Number(goal.monthly_amount).toLocaleString()}/{goal.frequency === "weekly" ? "wk" : "mo"}</span>
                        <span>• {goal.duration_months} months</span>
                      </div>
                      <div className="flex justify-between border-t border-emerald-200 dark:border-emerald-800/50 pt-1 mt-0.5">
                        <span>Started: {goal.start_date}</span>
                        <span className="font-bold text-rose-600 dark:text-rose-400">Mature: {goal.mature_date || "—"}</span>
                      </div>
                    </div>
                  )}


                  {/* Actions */}
                  {addFundsGoal === goal.id ? (
                    <div className="flex gap-2 items-center mt-2">
                      <div className="flex items-center flex-1">
                        <span className="bg-muted px-2 py-1.5 rounded-l-md border border-r-0 border-border text-xs">৳</span>
                        <Input type="number" placeholder="Amount" className="rounded-l-none h-8 text-sm" value={fundForm.amount} onChange={e => setFundForm({ amount: e.target.value })} />
                      </div>
                      <Button size="sm" className="h-8 px-2" onClick={handleAddFunds} disabled={!fundForm.amount}><Check className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => { setAddFundsGoal(null); setFundForm(INITIAL_FUND_FORM); }}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  ) : scheduleViewGoal === goal.id ? null : (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(goal)}>Edit</Button>
                      <Button size="sm" disabled={isCompleted} onClick={() => { 
                         if (goal.is_recurring) setScheduleViewGoal(goal.id);
                         else { setAddFundsGoal(goal.id); setFundForm(INITIAL_FUND_FORM); setShowForm(false); }
                      }}>
                        {goal.is_recurring ? "Schedule" : "Add Funds"}
                      </Button>
                    </div>
                  )}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Add goal card */}
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm(INITIAL_FORM); setAddFundsGoal(null); }}
            className="flex flex-col items-center justify-center min-h-[220px] rounded-xl border-2 border-dashed border-muted-foreground/25 hover:bg-card/50 hover:border-primary/50 transition-colors group p-6">
            <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Plus className="h-6 w-6" />
            </div>
            <span className="font-semibold text-lg mb-1">Create New Goal</span>
            <span className="text-sm text-muted-foreground text-center">Regular goal or DPS plan.</span>
          </button>
        </div>
      )}
    </div>
  );
}
