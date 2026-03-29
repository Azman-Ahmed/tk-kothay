import { createContext, useContext, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/browser-client";

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    localStorage.setItem("theme", theme);
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    if (!supabase) {
      setIsLoadingAuth(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoadingAuth(false);
    });

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [supabase]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      setUser(null);
    }
  };

  return (
    <AppContext.Provider value={{ theme, toggleTheme, user, session, isLoadingAuth, handleSignOut }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
