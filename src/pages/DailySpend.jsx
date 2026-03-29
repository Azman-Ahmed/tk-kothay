import { useState, useEffect, useCallback } from "react";
import { Coffee, Plus, Search, Pencil, Trash2, X, Check, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { getSupabaseBrowserClient } from "../lib/supabase/browser-client";

const TODAY = new Date().toISOString().split("T")[0];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function toYearMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(ym) {
  const [y, m] = ym.split("-");
  return `${MONTHS[parseInt(m) - 1]} ${y}`;
}

const INITIAL_FORM = { amount: "", note: "", date: TODAY };

export function DailySpend() {
  const [selectedMonth, setSelectedMonth] = useState(toYearMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [view, setView] = useState("day"); // "day" | "month"

  const [dailySpends, setDailySpends] = useState([]);
  const [monthlySummary, setMonthlySummary] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const supabase = getSupabaseBrowserClient();

  const shiftMonth = (delta) => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(toYearMonth(d));
  };

  const shiftDay = (delta) => {
    const [y, m, day] = selectedDate.split("-").map(Number);
    const d = new Date(y, m - 1, day + delta);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  // Fetch single-day entries
  const fetchDaySpends = useCallback(async () => {
    if (view !== "day") return;
    setLoading(true);
    const { data, error } = await supabase
      .from("daily_spends").select("*").eq("date", selectedDate)
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    else setDailySpends(data || []);
    setLoading(false);
  }, [selectedDate, view]);

  // Fetch monthly summary
  const fetchMonthSpends = useCallback(async () => {
    if (view !== "month") return;
    setLoading(true);
    const [y, m] = selectedMonth.split("-");
    const startDate = `${y}-${m}-01`;
    const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
    const endDate = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
    const { data, error } = await supabase
      .from("daily_spends").select("date, amount")
      .gte("date", startDate).lte("date", endDate)
      .order("date", { ascending: true });
    if (error) console.error(error);
    else {
      const grouped = {};
      (data || []).forEach(row => { grouped[row.date] = (grouped[row.date] || 0) + Number(row.amount); });
      setMonthlySummary(Object.entries(grouped).map(([date, total]) => ({ date, total })));
    }
    setLoading(false);
  }, [selectedMonth, view]);

  useEffect(() => { fetchDaySpends(); }, [fetchDaySpends]);
  useEffect(() => { fetchMonthSpends(); }, [fetchMonthSpends]);

  const handleSave = async () => {
    if (!form.amount || isNaN(form.amount) || !form.note.trim()) return;
    setSaving(true);
    if (editingId) {
      await supabase.from("daily_spends").update({ amount: Number(form.amount), note: form.note, date: form.date }).eq("id", editingId);
    } else {
      await supabase.from("daily_spends").insert([{ amount: Number(form.amount), note: form.note, date: selectedDate }]);
    }
    setForm({ ...INITIAL_FORM, date: selectedDate });
    setEditingId(null);
    setSaving(false);
    fetchDaySpends();
    fetchMonthSpends();
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({ amount: String(item.amount), note: item.note, date: item.date });
    setView("day");
    setSelectedDate(item.date);
  };

  const handleDelete = async (id) => {
    await supabase.from("daily_spends").delete().eq("id", id);
    setDeleteConfirm(null);
    fetchDaySpends();
    fetchMonthSpends();
  };

  const totalDay = dailySpends.reduce((s, i) => s + Number(i.amount), 0);
  const totalMonth = monthlySummary.reduce((s, d) => s + d.total, 0);
  const maxDayTotal = Math.max(...monthlySummary.map(d => d.total), 1);

  const filteredSpends = dailySpends.filter(item => item.note.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Daily Spend Tracker</h1>
          <p className="text-muted-foreground">Quickly track small, everyday expenses.</p>
        </div>

        {/* View Toggle + Navigator */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            <button
              className={`px-3 py-1.5 transition-colors ${view === "day" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
              onClick={() => setView("day")}>Day</button>
            <button
              className={`px-3 py-1.5 transition-colors ${view === "month" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
              onClick={() => setView("month")}>Month</button>
          </div>

          {view === "day" ? (
            <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-2 py-1.5">
              <button onClick={() => shiftDay(-1)} className="p-0.5 rounded hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
              <input type="date" value={selectedDate}
                onChange={e => { setSelectedDate(e.target.value); setForm(f => ({ ...f, date: e.target.value })); }}
                className="bg-transparent text-sm focus:outline-none w-32 text-center" />
              <button onClick={() => shiftDay(1)} className="p-0.5 rounded hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-2 py-1.5">
              <button onClick={() => shiftMonth(-1)} className="p-0.5 rounded hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-sm font-semibold w-24 text-center">{monthLabel(selectedMonth)}</span>
              <button onClick={() => shiftMonth(1)} className="p-0.5 rounded hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
            </div>
          )}
        </div>
      </div>

      {/* ======================== DAY VIEW ======================== */}
      {view === "day" && (
        <div className="grid gap-6 md:grid-cols-4">
          {/* Left: total + form */}
          <div className="md:col-span-1 space-y-4">
            <Card className="bg-rose-50 dark:bg-rose-950 border-rose-200 dark:border-rose-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-rose-800 dark:text-rose-300">
                  {selectedDate === TODAY ? "Today's" : selectedDate} Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-rose-600 dark:text-rose-400">৳{totalDay.toLocaleString()}</div>
                <p className="text-xs text-rose-700 dark:text-rose-500 mt-1">{dailySpends.length} transactions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Coffee className="h-4 w-4 text-amber-500" />
                  {editingId ? "Edit Entry" : "Quick Add"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Amount (৳)</label>
                  <div className="flex items-center">
                    <span className="bg-muted px-3 py-2 rounded-l-md border border-r-0 border-border text-sm">৳</span>
                    <Input type="number" placeholder="50" className="rounded-l-none" value={form.amount}
                      onChange={e => setForm({ ...form, amount: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">What was it for?</label>
                  <Input placeholder="e.g., Tea, Rickshaw..." value={form.note}
                    onChange={e => setForm({ ...form, note: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={handleSave} disabled={saving || !form.amount || !form.note.trim()}>
                    {saving ? "..." : editingId ? "Update" : <><Plus className="mr-1 h-4 w-4" />Add</>}
                  </Button>
                  {editingId && <Button variant="outline" onClick={() => { setForm({ ...INITIAL_FORM, date: selectedDate }); setEditingId(null); }}><X className="h-4 w-4" /></Button>}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: list */}
          <div className="md:col-span-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">{selectedDate === TODAY ? "Today's" : selectedDate} Transactions</CardTitle>
                <div className="relative hidden sm:block">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input type="search" placeholder="Filter..." className="pl-8 h-9 w-44" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {loading ? <p className="text-muted-foreground text-center py-8">Loading...</p>
                    : filteredSpends.length === 0 ? <p className="text-muted-foreground text-center py-8">No spends for this day yet.</p>
                    : filteredSpends.map(item => (
                      <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors ${editingId === item.id ? "ring-2 ring-primary" : ""}`}>
                        <div>
                          <p className="font-medium text-sm">{item.note}</p>
                          <p className="text-xs text-muted-foreground">{item.date}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-rose-600 dark:text-rose-400">- ৳{Number(item.amount).toLocaleString()}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-blue-500" onClick={() => handleEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                          {deleteConfirm === item.id ? (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => handleDelete(item.id)}><Check className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteConfirm(null)}><X className="h-3.5 w-3.5" /></Button>
                            </div>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-rose-500" onClick={() => setDeleteConfirm(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ======================== MONTH VIEW ======================== */}
      {view === "month" && (
        <div className="grid gap-6 md:grid-cols-4">
          {/* Left: month total */}
          <div className="md:col-span-1 space-y-4">
            <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  {monthLabel(selectedMonth)} Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">৳{totalMonth.toLocaleString()}</div>
                <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">{monthlySummary.length} days with spends</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground text-center">Switch to <strong>Day</strong> view to add or edit entries.</p>
                <Button variant="outline" className="w-full mt-3" onClick={() => setView("day")}>
                  <CalendarDays className="mr-2 h-4 w-4" /> Go to Day View
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right: daily summary table */}
          <div className="md:col-span-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-amber-500" />
                  Per-Day Breakdown — {monthLabel(selectedMonth)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <p className="text-muted-foreground text-center py-8">Loading...</p>
                  : monthlySummary.length === 0 ? (
                    <div className="text-center py-12">
                      <CalendarDays className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">No daily spends for {monthLabel(selectedMonth)}.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground text-xs">
                            <th className="text-left py-2 font-medium">Date</th>
                            <th className="text-right py-2 font-medium">Amount</th>
                            <th className="text-right py-2 font-medium pr-1">% of Max</th>
                            <th className="py-2 pl-3 w-40">Visual</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlySummary.map(({ date, total }) => {
                            const pct = (total / maxDayTotal) * 100;
                            const isToday = date === TODAY;
                            return (
                              <tr key={date}
                                className={`border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer ${isToday ? "bg-primary/5" : ""}`}
                                onClick={() => { setView("day"); setSelectedDate(date); }}>
                                <td className={`py-2.5 font-medium ${isToday ? "text-primary" : ""}`}>
                                  {date} {isToday && <span className="text-xs text-primary ml-1">(today)</span>}
                                </td>
                                <td className="py-2.5 text-right font-semibold text-rose-600 dark:text-rose-400">৳{total.toLocaleString()}</td>
                                <td className="py-2.5 text-right text-muted-foreground pr-1">{pct.toFixed(0)}%</td>
                                <td className="py-2.5 pl-3">
                                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-400 dark:bg-amber-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-border">
                            <td className="py-3 font-bold">Monthly Total</td>
                            <td className="py-3 text-right font-bold text-amber-600 dark:text-amber-400">৳{totalMonth.toLocaleString()}</td>
                            <td colSpan={2} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
