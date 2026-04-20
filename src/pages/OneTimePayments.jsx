import { useState, useEffect, useCallback } from "react";
import {
  Search, Pencil, Trash2, Coffee, Home, Bus, Zap, Film,
  ShoppingCart, X, Check, ChevronLeft, ChevronRight, Plus
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { getSupabaseBrowserClient } from "../lib/supabase/browser-client";
import { formatLocalDate } from "../lib/utils";


const CATEGORY_MAP = {
  Shopping:      { icon: ShoppingCart, color: "text-pink-500",    bg: "bg-pink-100 dark:bg-pink-900/30" },
  Food:          { icon: Coffee,       color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  Transport:     { icon: Bus,          color: "text-orange-500",  bg: "bg-orange-100 dark:bg-orange-900/30" },
  Entertainment: { icon: Film,         color: "text-purple-500",  bg: "bg-purple-100 dark:bg-purple-900/30" },
  Electronics:   { icon: Zap,          color: "text-blue-500",    bg: "bg-blue-100 dark:bg-blue-900/30" },
  Home:          { icon: Home,         color: "text-indigo-500",  bg: "bg-indigo-100 dark:bg-indigo-900/30" },
  Medical:       { icon: Zap,          color: "text-red-500",     bg: "bg-red-100 dark:bg-red-900/30" },
  Other:         { icon: ShoppingCart, color: "text-slate-500",   bg: "bg-slate-100 dark:bg-slate-900/30" },
};
const getCategoryAssets = (cat) => CATEGORY_MAP[cat] || CATEGORY_MAP.Other;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function toYearMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(ym) {
  const [y, m] = ym.split("-");
  return `${MONTHS[parseInt(m) - 1]} ${y}`;
}

const INITIAL_FORM = {
  category: "Shopping",
  amount: "",
  date: formatLocalDate(),
  payment_method: "debit",
  notes: "",
};

export function OneTimePayments() {
  const [selectedMonth, setSelectedMonth] = useState(toYearMonth(new Date()));
  const [payments, setPayments] = useState([]);
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

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    const [y, m] = selectedMonth.split("-");
    const startDate = `${y}-${m}-01`;
    const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
    const endDate = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });
    if (error) console.error("Error:", error);
    else setPayments(data || []);
    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const handleSave = async () => {
    if (!form.amount || isNaN(form.amount)) return;
    setSaving(true);
    if (editingId) {
      await supabase.from("expenses").update({
        category: form.category, amount: Number(form.amount), date: form.date, payment_method: form.payment_method, notes: form.notes,
      }).eq("id", editingId);
    } else {
      await supabase.from("expenses").insert([{
        category: form.category, amount: Number(form.amount), date: form.date, payment_method: form.payment_method, notes: form.notes,
      }]);
    }
    setForm(INITIAL_FORM);
    setEditingId(null);
    setSaving(false);
    fetchPayments();
  };

  const handleEdit = (p) => {
    setEditingId(p.id);
    setForm({ category: p.category, amount: String(p.amount), date: p.date, payment_method: p.payment_method || "debit", notes: p.notes || "" });
  };

  const handleDelete = async (id) => {
    await supabase.from("expenses").delete().eq("id", id);
    setDeleteConfirm(null);
    fetchPayments();
  };

  const filtered = payments.filter(p =>
    p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAmount = payments.reduce((s, p) => s + Number(p.amount), 0);

  const selectClass = "flex h-10 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">One-Time Payments</h1>
          <p className="text-muted-foreground">Track irregular purchases and ad-hoc expenses.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Month nav */}
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-2 py-1.5">
            <button onClick={() => shiftMonth(-1)} className="p-1 rounded hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm font-semibold w-24 text-center">{monthLabel(selectedMonth)}</span>
            <button onClick={() => shiftMonth(1)} className="p-1 rounded hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
          </div>
          {/* Total */}
          <div className="bg-pink-50 dark:bg-pink-950 border border-pink-200 dark:border-pink-800 rounded-lg px-4 py-2 text-right">
            <p className="text-xs text-pink-600 dark:text-pink-400 font-medium">This Month</p>
            <p className="text-xl font-bold text-pink-700 dark:text-pink-300">৳{totalAmount.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Form */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingId ? "Edit Payment" : "New One-Time Payment"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={selectClass}>
                  {Object.keys(CATEGORY_MAP).map(cat => <option key={cat} value={cat}>{cat}</option>)}
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
                <label className="text-sm font-medium">Payment Method</label>
                <div className="flex gap-2">
                  <button onClick={() => setForm({ ...form, payment_method: 'debit' })} className={`flex-1 py-1.5 text-sm font-semibold rounded-md border transition-colors ${form.payment_method === 'debit' ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent border-border text-muted-foreground'}`}>Debit (Current Bal)</button>
                  <button onClick={() => setForm({ ...form, payment_method: 'credit' })} className={`flex-1 py-1.5 text-sm font-semibold rounded-md border transition-colors ${form.payment_method === 'credit' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-transparent border-border text-muted-foreground'}`}>Credit Card</button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Notes (Optional)</label>
                <Input placeholder="e.g. New phone case" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  className="flex-1 bg-pink-500 hover:bg-pink-600 text-white"
                  onClick={handleSave}
                  disabled={saving || !form.amount}
                >
                  {saving ? "Saving..." : editingId ? "Update" : "Save Payment"}
                </Button>
                {editingId && (
                  <Button variant="outline" onClick={() => { setForm(INITIAL_FORM); setEditingId(null); }}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* History */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Payments in {monthLabel(selectedMonth)}</CardTitle>
              <div className="relative hidden sm:block">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search..."
                  className="pl-8 h-9 w-48"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {loading ? (
                  <p className="text-muted-foreground text-center py-8">Loading...</p>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">No one-time payments for {monthLabel(selectedMonth)}.</p>
                    <p className="text-xs text-muted-foreground mt-1">Add a purchase using the form on the left.</p>
                  </div>
                ) : (
                  filtered.map(p => {
                    const { icon: Icon, color, bg } = getCategoryAssets(p.category);
                    return (
                      <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow ${editingId === p.id ? "ring-2 ring-pink-400" : ""}`}>
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${bg} ${color}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{p.category}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.date} • <span className={`font-semibold ${p.payment_method === 'credit' ? 'text-indigo-500' : 'text-emerald-600'}`}>{p.payment_method === 'credit' ? 'Credit' : 'Debit'}</span>
                              {p.notes ? ` • ${p.notes}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-sm ${p.payment_method === 'credit' ? 'text-indigo-600 dark:text-indigo-400' : 'text-pink-600 dark:text-pink-400'}`}>- ৳{Number(p.amount).toLocaleString()}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-blue-500" onClick={() => handleEdit(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {deleteConfirm === p.id ? (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => handleDelete(p.id)}>
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteConfirm(null)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-rose-500" onClick={() => setDeleteConfirm(p.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
