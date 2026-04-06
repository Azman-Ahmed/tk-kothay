import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser-client";

export function Callback() {
  const [errorMsg, setErrorMsg] = useState(null);
  const navigate = useNavigate();
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    const checkAuthStatus = async () => {
      // Small delay to ensure Supabase has processed the fragment/hash
      await new Promise(r => setTimeout(r, 500));
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (session) {
        navigate("/", { replace: true });
      } else if (error) {
        console.error("Auth callback error:", error);
        setErrorMsg(error.message);
      } else {
        // Fallback if no session found yet
        const timeout = setTimeout(() => navigate("/", { replace: true }), 3000);
        return () => clearTimeout(timeout);
      }
    };


    checkAuthStatus();
  }, [navigate, supabase]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background bg-slate-50 dark:bg-slate-900">
      <div className="max-w-md w-full px-6 flex flex-col items-center gap-6 text-center">
        {!errorMsg ? (
          <>
            <div className="animate-spin h-12 w-12 border-4 border-emerald-500 border-t-transparent rounded-full shadow-lg shadow-emerald-500/20"></div>
            <p className="text-emerald-700 dark:text-emerald-400 font-medium tracking-wide animate-pulse">
              Completing authentication...
            </p>
          </>
        ) : (
          <div className="space-y-4 bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl border border-rose-100 dark:border-rose-900/30">
            <div className="h-12 w-12 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <X className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Authentication Failed</h2>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <Button onClick={() => navigate("/login")} className="w-full">
              Back to Login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

