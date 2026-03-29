import { useState, useEffect, useCallback } from "react";
import { PiggyBank, ArrowUpRight, ArrowDownLeft, ShieldCheck, Wallet, RefreshCw, Info } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { getSupabaseBrowserClient } from "../lib/supabase/browser-client";

export function BalanceSheet() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    savings: 0,
    loansGiven: 0,
    loansTaken: 0,
    netWorth: 0,
    savingsBreakdown: [],
    loansGivenBreakdown: [],
    loansTakenBreakdown: []
  });

  const supabase = getSupabaseBrowserClient();

  const fetchBalanceSheet = useCallback(async () => {
    setLoading(true);
    const [
      { data: savingsData },
      { data: loansData }
    ] = await Promise.all([
      supabase.from("savings_goals").select("name, current_amount"),
      supabase.from("loans").select("partner_name, amount, remaining_amount, type")
    ]);

    const totalSavings = (savingsData || []).reduce((s, g) => s + Number(g.current_amount), 0);
    const totalLoansGiven = (loansData || []).filter(l => l.type === 'given').reduce((s, l) => s + Number(l.remaining_amount), 0);
    const totalLoansTaken = (loansData || []).filter(l => l.type === 'taken').reduce((s, l) => s + Number(l.remaining_amount), 0);
    
    const assets = totalSavings + totalLoansGiven;
    const liabilities = totalLoansTaken;
    const netWorth = assets - liabilities;

    setData({
      savings: totalSavings,
      loansGiven: totalLoansGiven,
      loansTaken: totalLoansTaken,
      netWorth,
      assets,
      liabilities,
      savingsBreakdown: savingsData || [],
      loansGivenBreakdown: (loansData || []).filter(l => l.type === 'given'),
      loansTakenBreakdown: (loansData || []).filter(l => l.type === 'taken')
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBalanceSheet();
  }, [fetchBalanceSheet]);

  const fmt = (n) => Number(n || 0).toLocaleString();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Balance Sheet</h1>
          <p className="text-muted-foreground">Snapshot of your overall financial health.</p>
        </div>
        <Button variant="outline" onClick={fetchBalanceSheet} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-24">
          <RefreshCw className="h-12 w-12 animate-spin mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Calculating your net worth...</p>
        </div>
      ) : (
        <>
          {/* Net Worth Scorecard */}
          <Card className="bg-primary/5 border-primary/20 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <ShieldCheck className="h-32 w-32" />
            </div>
            <CardContent className="pt-8 pb-8 flex flex-col items-center justify-center text-center">
              <p className="text-sm font-semibold text-primary/70 uppercase tracking-widest mb-1">Your Net Worth</p>
              <h2 className={`text-5xl font-extrabold tracking-tighter ${data.netWorth >= 0 ? 'text-primary' : 'text-rose-600'}`}>
                ৳{fmt(data.netWorth)}
              </h2>
              <div className="mt-6 flex gap-8">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground font-bold uppercase mb-1">Total Assets</p>
                  <p className="text-lg font-bold text-emerald-600">৳{fmt(data.assets)}</p>
                </div>
                <div className="h-10 w-px bg-border my-auto" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground font-bold uppercase mb-1">Total Liabilities</p>
                  <p className="text-lg font-bold text-rose-600">৳{fmt(data.liabilities)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* ASSETS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold">Assets</h3>
                <span className="text-sm text-emerald-600 font-semibold ml-auto">৳{fmt(data.assets)}</span>
              </div>

              {/* Savings Goals */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <PiggyBank className="h-4 w-4 text-emerald-500" /> Savings & Goals
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {data.savingsBreakdown.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2 italic">None yet recorded.</p>
                  ) : (
                    data.savingsBreakdown.map(g => (
                      <div key={g.name} className="flex justify-between items-center py-2 border-b border-border last:border-0 hover:bg-muted/50 rounded px-2 transition-colors">
                        <span className="text-sm font-medium">{g.name}</span>
                        <span className="text-sm font-bold text-emerald-600">৳{fmt(g.current_amount)}</span>
                      </div>
                    ))
                  )}
                  <div className="flex justify-between items-center pt-3 mt-1 border-t-2 border-emerald-100 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 font-bold px-2">
                    <span>Total Cash & Savings</span>
                    <span>৳{fmt(data.savings)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Loans Given */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ArrowUpRight className="h-4 w-4 text-sky-500" /> Loans Given (Lent)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {data.loansGivenBreakdown.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2 italic">None yet recorded.</p>
                  ) : (
                    data.loansGivenBreakdown.map(l => (
                      <div key={l.id} className="flex justify-between items-center py-2 border-b border-border last:border-0 hover:bg-muted/50 rounded px-2 transition-colors">
                        <span className="text-sm font-medium">{l.partner_name}</span>
                        <span className="text-sm font-bold text-sky-600">৳{fmt(l.remaining_amount)}</span>
                      </div>
                    ))
                  )}
                  <div className="flex justify-between items-center pt-3 mt-1 border-t-2 border-sky-100 dark:border-sky-900 text-sky-700 dark:text-sky-400 font-bold px-2">
                    <span>Total Outstanding Receivables</span>
                    <span>৳{fmt(data.loansGiven)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* LIABILITIES */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 flex items-center justify-center">
                  <ArrowDownLeft className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold">Liabilities</h3>
                <span className="text-sm text-rose-600 font-semibold ml-auto">৳{fmt(data.liabilities)}</span>
              </div>

              {/* Loans Taken */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ArrowDownLeft className="h-4 w-4 text-rose-500" /> Loans Taken (Borrowed)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {data.loansTakenBreakdown.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2 italic text-center">No outstanding debts recorded! 🎉</p>
                  ) : (
                    data.loansTakenBreakdown.map(l => (
                      <div key={l.id} className="flex justify-between items-center py-2 border-b border-border last:border-0 hover:bg-muted/50 rounded px-2 transition-colors">
                        <div>
                          <span className="text-sm font-medium text-rose-600 block">{l.partner_name}</span>
                          <span className="text-[10px] text-muted-foreground block">Original: ৳{fmt(l.amount)}</span>
                        </div>
                        <span className="text-sm font-bold text-rose-700">৳{fmt(l.remaining_amount)}</span>
                      </div>
                    ))
                  )}
                  <div className="flex justify-between items-center pt-3 mt-1 border-t-2 border-rose-100 dark:border-rose-900 text-rose-700 dark:text-rose-400 font-bold px-2">
                    <span>Total Outstanding Debt</span>
                    <span>৳{fmt(data.loansTaken)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Credit Card (Placeholder) */}
              <Card className="opacity-40 grayscale pointer-events-none">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Credit Cards & Bills</CardTitle>
                  <Info className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-center py-4 italic">Future Module</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Button({ children, onClick, variant = "primary", className = "", disabled = false }) {
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground"
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors px-4 py-2 h-10 ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      {children}
    </button>
  );
}
