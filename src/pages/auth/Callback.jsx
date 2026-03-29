import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser-client";

export function Callback() {
  const navigate = useNavigate();
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    // Supabase automatically captures the auth token from the URL hash in the background.
    // This page acts as a staging ground to let that process finish seamlessly.
    const checkAuthStatus = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (session) {
        navigate("/", { replace: true });
      } else if (error) {
        // If there's an error in auth callback, route back to login
        navigate("/login", { replace: true });
      } else {
        // If no session but no error, onAuthStateChange listener in AppContext 
        // is likely currently processing it. We'll fallback to root after a short delay.
        setTimeout(() => navigate("/", { replace: true }), 1500);
      }
    };

    checkAuthStatus();
  }, [navigate, supabase]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background bg-slate-50 dark:bg-slate-900 border-emerald-500">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin h-12 w-12 border-4 border-emerald-500 border-t-transparent rounded-full shadow-lg shadow-emerald-500/20"></div>
        <p className="text-emerald-700 dark:text-emerald-400 font-medium tracking-wide animate-pulse">
          Completing authentication...
        </p>
      </div>
    </div>
  );
}
