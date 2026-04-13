import { useState, useEffect, useCallback } from "react";
import { CreditCard, AlertCircle, ShoppingCart, RefreshCw, Pencil, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { getSupabaseBrowserClient } from "../lib/supabase/browser-client";

export default function CreditDashboard() {
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(0);
  const [isEditingLimit, setIsEditingLimit] = useState(false);
  const [tempLimit, setTempLimit] = useState("");
  const [usage, setUsage] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [savingLimit, setSavingLimit] = useState(false);

  const supabase = getSupabaseBrowserClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [
      { data: settings },
      { data: expenses },
      { data: daily },
      { data: dps },
      { data: loans },
      { data: billPayments }
    ] = await Promise.all([
      supabase.from("credit_settings").select("*").single(),
      supabase.from("expenses").select("*").eq("payment_method", "credit"),
      supabase.from("daily_spends").select("*").eq("payment_method", "credit"),
      supabase.from("dps_payments").select("*").eq("payment_method", "credit"),
      supabase.from("loan_payments").select("*").eq("payment_method", "credit"),
      supabase.from("credit_bill_payments").select("*")
    ]);

    const userLimit = settings?.credit_limit || 0;
    setLimit(userLimit);
    setTempLimit(userLimit.toString());

    // Calculate total spent
    const spentExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount), 0);
    const spentDaily = (daily || []).reduce((s, d) => s + Number(d.amount), 0);
    const spentDps = (dps || []).reduce((s, p) => s + Number(p.amount), 0);
    const spentLoans = (loans || []).reduce((s, p) => s + Number(p.amount), 0);
    
    // Total historical credit spend
    const totalCreditSpentTotal = spentExpenses + spentDaily + spentDps + spentLoans;
    
    // Total historical bill payments
    const totalPaymentsToCredit = (billPayments || []).reduce((s, p) => s + Number(p.amount), 0);
    
    // Current outstanding balance
    const currentUsage = Math.max(0, totalCreditSpentTotal - totalPaymentsToCredit);
    setUsage(currentUsage);

    // Combine for transaction list
    const combined = [
      ...(expenses || []).map(e => ({ ...e, type: 'Expense', icon: ShoppingCart, color: 'text-indigo-500' })),
      ...(daily || []).map(d => ({ ...d, type: 'Daily Spend', note: d.note, icon: ShoppingCart, color: 'text-sky-500' })),
      ...(dps || []).map(p => ({ ...p, type: 'DPS Installment', note: 'Savings Contribution', date: p.paid_at.split('T')[0], icon: CreditCard, color: 'text-emerald-500' })),
      ...(loans || []).map(p => ({ ...p, type: 'Loan Payment', note: 'Repayment', date: p.paid_at.split('T')[0], icon: CreditCard, color: 'text-rose-500' }))
    ].sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));

    setTransactions(combined);
    setLoading(false);
  }, [supabase]);

  const handleUpdateLimit = async () => {
    setSavingLimit(true);
    const val = Number(tempLimit);
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from("credit_settings")
      .upsert({ user_id: user.id, credit_limit: val, updated_at: new Date().toISOString() });

    if (!error) {
      setLimit(val);
      setIsEditingLimit(false);
    }
    setSavingLimit(false);
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const usagePercent = limit > 0 ? Math.min(100, (usage / limit) * 100) : 0;
  const available = Math.max(0, limit - usage);

  const getUsageColor = (pct) => {
    if (pct > 90) return "bg-rose-500";
    if (pct > 70) return "bg-amber-500";
    return "bg-indigo-600";
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credit Dashboard</h1>
          <p className="text-muted-foreground">Manage your credit card limit and monitor your swiped balances.</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Usage Card */}
        <Card className="col-span-1 lg:col-span-2 shadow-lg border-indigo-100 dark:border-indigo-900 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <CreditCard size={120} />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <CreditCard className="text-indigo-600" />
              Total Credit Usage
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex justify-between items-end mb-4">
              <div>
                <p className="text-4xl font-black text-indigo-600 dark:text-indigo-400">৳{usage.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground font-medium mt-1">Outstanding Balance</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-foreground">৳{available.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Available Credit</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <span>Usage Depth</span>
                <span>{usagePercent.toFixed(1)}%</span>
              </div>
              <div className="h-4 w-full bg-muted rounded-full overflow-hidden p-0.5 border border-border shadow-inner">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${getUsageColor(usagePercent)}`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            </div>

            {usagePercent > 90 && (
              <div className="mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-rose-700 dark:text-rose-400 text-sm animate-pulse">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="font-semibold">Extreme usage! You have less than 10% credit remaining.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Limit Settings Card */}
        <Card className="bg-slate-50 dark:bg-slate-900 border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Credit Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block tracking-tight">Total Credit Limit (৳)</label>
              {isEditingLimit ? (
                <div className="flex gap-2">
                  <Input 
                    type="number" 
                    value={tempLimit} 
                    onChange={e => setTempLimit(e.target.value)}
                    className="h-10 text-lg font-bold"
                  />
                  <Button size="icon" onClick={handleUpdateLimit} disabled={savingLimit}>
                    {savingLimit ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { setIsEditingLimit(false); setTempLimit(limit.toString()); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between group cursor-pointer p-2 rounded-lg hover:bg-muted transition-colors" onClick={() => setIsEditingLimit(true)}>
                  <p className="text-3xl font-black">৳{limit.toLocaleString()}</p>
                  <Pencil className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                </div>
              )}
            </div>
            
            <div className="pt-2">
               <div className="bg-card p-3 rounded-lg border border-border shadow-sm">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Information</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Any transaction (Daily, One-time, Loans) paid via <span className="text-indigo-600 font-bold">Credit</span> is tracked here.
                    Payments made to your credit bill will restore your available limit.
                  </p>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credit Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle>Credit Utilization History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {transactions.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <ShoppingCart className="h-10 w-10 mx-auto opacity-10 mb-2" />
                <p>No credit transactions recorded yet.</p>
              </div>
            ) : (
              <div className="divide-y">
                {transactions.map((t, idx) => {
                  const Icon = t.icon;
                  return (
                    <div key={`${t.type}-${t.id}-${idx}`} className="flex items-center justify-between py-3 px-1 hover:bg-muted/30 rounded transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center bg-muted ${t.color}`}>
                          <Icon size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{t.note || t.source || t.category || 'Transaction'}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 uppercase px-1 rounded">{t.type}</span>
                            <span>{t.date || (t.created_at ? t.created_at.split('T')[0] : '')}</span>
                          </div>
                        </div>
                      </div>
                      <p className="font-black text-sm text-indigo-600">- ৳{Number(t.amount).toLocaleString()}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
