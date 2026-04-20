import { useState, useEffect, useCallback } from "react";
import { Search, Pencil, Trash2, Building, Briefcase, DollarSign, GraduationCap, X, Check, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { getSupabaseBrowserClient } from "../lib/supabase/browser-client";
import { formatLocalDate } from "../lib/utils";


const SOURCE_MAP = {
  Salary:     { icon: Building,    color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  Business:   { icon: TrendingUp,  color: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-100 dark:bg-blue-900/30" },
  Freelance:  { icon: Briefcase,   color: "text-purple-600 dark:text-purple-400",   bg: "bg-purple-100 dark:bg-purple-900/30" },
  Investment: { icon: TrendingUp,  color: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-100 dark:bg-amber-900/30" },
  Gift:       { icon: DollarSign,  color: "text-pink-600 dark:text-pink-400",       bg: "bg-pink-100 dark:bg-pink-900/30" },
  Other:      { icon: GraduationCap, color: "text-slate-600 dark:text-slate-400",   bg: "bg-slate-100 dark:bg-slate-900/30" },
};
const getSourceAssets = (src) => SOURCE_MAP[src] || SOURCE_MAP.Other;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function toYearMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(ym) {
  const [y, m] = ym.split("-");
  return `${MONTHS[parseInt(m) - 1]} ${y}`;
}

const INITIAL_FORM = { source: "Salary", amount: "", date: formatLocalDate(), notes: "" };


export function Income() {
  const [selectedMonth, setSelectedMonth] = useState(toYearMonth(new Date()));
  const [incomes, setIncomes] = useState([]);
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

  const fetchIncomes = useCallback(async () => {
    setLoading(true);
    const [y, m] = selectedMonth.split("-");
    const startDate = `${y}-${m}-01`;
    const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
    const endDate = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
    const { data, error } = await supabase
      .from("incomes").select("*")
      .gte("date", startDate).lte("date", endDate)
      .order("date", { ascending: false });
    if (error) console.error("Error fetching incomes:", error);
    else setIncomes(data || []);
    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => { fetchIncomes(); }, [fetchIncomes]);

  const handleSave = async () => {
    if (!form.amount || isNaN(form.amount)) return;
    setSaving(true);
    if (editingId) {
      await supabase.from("incomes").update({
        source: form.source, amount: Number(form.amount), date: form.date, notes: form.notes,
      }).eq("id", editingId);
    } else {
      await supabase.from("incomes").insert([{
        source: form.source, amount: Number(form.amount), date: form.date, notes: form.notes,
      }]);
    }
    setForm(INITIAL_FORM);
    setEditingId(null);
    setSaving(false);
    fetchIncomes();
  };

  const handleEdit = (inc) => {
    setEditingId(inc.id);
    setForm({ source: inc.source, amount: String(inc.amount), date: inc.date, notes: inc.notes || "" });
  };

  const handleDelete = async (id) => {
    await supabase.from("incomes").delete().eq("id", id);
    setDeleteConfirm(null);
    fetchIncomes();
  };

  const filteredIncomes = incomes.filter(inc =>
    inc.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inc.source.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAmount = incomes.reduce((sum, i) => sum + Number(i.amount), 0);

  const selectClass = "flex h-10 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Income Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Track and manage your various income streams.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Month Picker */}
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-2 py-1.5">
            <button onClick={() => shiftMonth(-1)} className="p-1 rounded hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold w-24 text-center">{monthLabel(selectedMonth)}</span>
            <button onClick={() => shiftMonth(1)} className="p-1 rounded hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {/* Total */}
          <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg px-4 py-2 text-right">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Total Income</p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">৳{totalAmount.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Form */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{editingId ? "Edit Income" : "New Income Entry"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Source</label>
                <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className={selectClass}>
                  {Object.keys(SOURCE_MAP).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Amount (৳)</label>
                <Input type="number" placeholder="e.g. 5000" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Date</label>
                <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Notes (Optional)</label>
                <Input placeholder="Add a note..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button className="flex-1" onClick={handleSave} disabled={saving || !form.amount}>
                  {saving ? "Saving..." : editingId ? "Update Entry" : "Save Entry"}
                </Button>
                {editingId && <Button variant="outline" onClick={() => { setForm(INITIAL_FORM); setEditingId(null); }}><X className="h-4 w-4" /></Button>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* History */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Income — {monthLabel(selectedMonth)}</CardTitle>
              <div className="relative hidden sm:block">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Search..." className="pl-8 h-9 w-48" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {loading ? <p className="text-muted-foreground text-center py-8">Loading...</p>
                  : filteredIncomes.length === 0 ? <p className="text-muted-foreground text-center py-8">No income for {monthLabel(selectedMonth)}. Add one!</p>
                  : filteredIncomes.map(inc => {
                    const { icon: Icon, color, bg } = getSourceAssets(inc.source);
                    return (
                      <div key={inc.id} className={`flex items-center justify-between p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow ${editingId === inc.id ? "ring-2 ring-emerald-400" : ""}`}>
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${bg} ${color}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{inc.source}</p>
                            <p className="text-xs text-muted-foreground">{inc.date}{inc.notes ? ` • ${inc.notes}` : ""}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">+ ৳{Number(inc.amount).toLocaleString()}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-blue-500" onClick={() => handleEdit(inc)}><Pencil className="h-3.5 w-3.5" /></Button>
                          {deleteConfirm === inc.id ? (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => handleDelete(inc.id)}><Check className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteConfirm(null)}><X className="h-3.5 w-3.5" /></Button>
                            </div>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-rose-500" onClick={() => setDeleteConfirm(inc.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
