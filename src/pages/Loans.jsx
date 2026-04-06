import { useState, useEffect, useCallback } from "react";
import { Plus, Users, Calendar, Pencil, Trash2, X, Check, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { getSupabaseBrowserClient } from "../lib/supabase/browser-client";
import { formatLocalDate } from "../lib/utils";


const INITIAL_FORM = {
  partner_name: "",
  amount: "",
  type: "taken", // 'taken' or 'given'
  start_date: formatLocalDate(),
  due_date: "",
  notes: "",
};


export function Loans() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [activeTab, setActiveTab] = useState("taken"); // 'taken' | 'given'
  const [paymentAmount, setPaymentAmount] = useState("");
  const [payingLoanId, setPayingLoanId] = useState(null);

  const supabase = getSupabaseBrowserClient();

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("loans")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.error("Error fetching loans:", error);
    else setLoans(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  const handleSave = async () => {
    if (!form.partner_name.trim() || !form.amount) return;
    setSaving(true);
    
    const payload = {
      partner_name: form.partner_name,
      amount: Number(form.amount),
      remaining_amount: editingId ? undefined : Number(form.amount), // Only set initial on insert
      type: form.type,
      start_date: form.start_date,
      due_date: form.due_date || null,
      notes: form.notes,
    };

    if (editingId) {
      await supabase.from("loans").update(payload).eq("id", editingId);
    } else {
      await supabase.from("loans").insert([payload]);
    }

    setForm(INITIAL_FORM);
    setEditingId(null);
    setShowForm(false);
    setSaving(false);
    fetchLoans();
  };

  const handleEdit = (loan) => {
    setEditingId(loan.id);
    setForm({
      partner_name: loan.partner_name,
      amount: String(loan.amount),
      type: loan.type,
      start_date: loan.start_date,
      due_date: loan.due_date || "",
      notes: loan.notes || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    await supabase.from("loans").delete().eq("id", id);
    setDeleteConfirm(null);
    fetchLoans();
  };

  const handleAddPayment = async (loan) => {
    if (!paymentAmount || isNaN(paymentAmount)) return;
    
    const newRemaining = Math.max(0, Number(loan.remaining_amount) - Number(paymentAmount));
    
    const { error } = await supabase
      .from("loans")
      .update({ remaining_amount: newRemaining })
      .eq("id", loan.id);

    if (!error) {
      setPayingLoanId(null);
      setPaymentAmount("");
      fetchLoans();
    }
  };

  const filteredLoans = loans.filter(l => l.type === activeTab);
  const totalOutstanding = filteredLoans.reduce((sum, l) => sum + Number(l.remaining_amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Personal Loans</h1>
          <p className="text-muted-foreground">Manage money you've borrowed or lent to others.</p>
        </div>
        <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(INITIAL_FORM); }}>
          <Plus className="mr-2 h-4 w-4" /> New Loan
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className={activeTab === 'taken' ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/10' : ''} 
              onClick={() => setActiveTab('taken')} 
              style={{ cursor: 'pointer' }}>
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 flex items-center justify-center">
              <ArrowDownLeft className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Owed to Others</p>
              <p className="text-2xl font-bold text-rose-600">৳{fmt(loans.filter(l => l.type === 'taken').reduce((s, l) => s + Number(l.remaining_amount), 0))}</p>
            </div>
          </CardContent>
        </Card>

        <Card className={activeTab === 'given' ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/10' : ''} 
              onClick={() => setActiveTab('given')}
              style={{ cursor: 'pointer' }}>
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
              <ArrowUpRight className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Owed to Me</p>
              <p className="text-2xl font-bold text-emerald-600">৳{fmt(loans.filter(l => l.type === 'given').reduce((s, l) => s + Number(l.remaining_amount), 0))}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>{editingId ? "Edit Loan" : "Record New Loan"}</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Type</label>
                <select 
                  value={form.type} 
                  onChange={e => setForm({ ...form, type: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="taken">I Borrowed Money (Debt)</option>
                  <option value="given">I Lent Money (Asset)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{form.type === 'taken' ? "Borrowed From" : "Lent To"}</label>
                <Input placeholder="Person or Institution name" value={form.partner_name} onChange={e => setForm({ ...form, partner_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Amount (৳)</label>
                <Input type="number" placeholder="5000" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Start Date</label>
                <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-rose-500 font-bold">Deadline (Due Date)</label>
                <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Notes</label>
                <Input placeholder="Reason or extra details" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSave} disabled={saving || !form.partner_name || !form.amount}>
                {saving ? "Saving..." : editingId ? "Update Record" : "Save Record"}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border gap-1">
        <button onClick={() => setActiveTab("taken")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === "taken" ? "border-rose-500 text-rose-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          Money Borrowed (Debts)
        </button>
        <button onClick={() => setActiveTab("given")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === "given" ? "border-emerald-500 text-emerald-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          Money Lent (Assets)
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <p className="text-muted-foreground text-center py-12">Loading loans...</p>
        ) : filteredLoans.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-xl border-muted-foreground/20">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No records found for this category.</p>
          </div>
        ) : (
          filteredLoans.map(loan => {
            const progress = Math.round(((Number(loan.amount) - Number(loan.remaining_amount)) / Number(loan.amount)) * 100);
            const isFullyPaid = Number(loan.remaining_amount) === 0;
            const isOverdue = loan.due_date && new Date(loan.due_date) < new Date() && !isFullyPaid;

            return (
              <Card key={loan.id} className={isFullyPaid ? 'opacity-60 bg-muted/30' : ''}>
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold flex items-center gap-2">
                            {loan.partner_name}
                            {isFullyPaid && <span className="text-xs font-normal bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Fully Paid</span>}
                            {isOverdue && <span className="text-xs font-normal bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">Overdue</span>}
                          </h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> 
                            Borrowed on {loan.start_date} {loan.due_date ? `• Due by ${loan.due_date}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground uppercase font-semibold">Remaining</p>
                          <p className={`text-xl font-bold ${activeTab === 'taken' ? 'text-rose-600' : 'text-emerald-600'}`}>
                            ৳{fmt(loan.remaining_amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">Original: ৳{fmt(loan.amount)}</p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-500 ${activeTab === 'taken' ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${progress}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground font-medium">
                          <span>{progress}% Repaid</span>
                          <span>৳{fmt(Number(loan.amount) - Number(loan.remaining_amount))} Paid</span>
                        </div>
                      </div>

                      {loan.notes && <p className="text-sm bg-muted/50 p-2 rounded italic text-muted-foreground">"{loan.notes}"</p>}
                    </div>

                    <div className="flex flex-col gap-2 justify-center border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-4 min-w-[150px]">
                      {payingLoanId === loan.id ? (
                        <div className="space-y-2">
                          <Input type="number" placeholder="Payment amt" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="h-8 text-sm" />
                          <div className="flex gap-1">
                            <Button size="sm" className="flex-1" onClick={() => handleAddPayment(loan)}>Pay</Button>
                            <Button size="sm" variant="outline" onClick={() => setPayingLoanId(null)}><X className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      ) : (
                        <Button size="sm" disabled={isFullyPaid} onClick={() => setPayingLoanId(loan.id)}>
                          Add Payment
                        </Button>
                      )}
                      
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="flex-1 h-8" onClick={() => handleEdit(loan)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        {deleteConfirm === loan.id ? (
                          <div className="flex gap-1 flex-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500" onClick={() => handleDelete(loan.id)}><Check className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteConfirm(null)}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-rose-500" onClick={() => setDeleteConfirm(loan.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function fmt(n) { return Number(n || 0).toLocaleString(); }
