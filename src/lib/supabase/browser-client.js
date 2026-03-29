import { createBrowserClient } from "@supabase/ssr";

let client = null;

export function getSupabaseBrowserClient() {
  if (client) {
    return client;
  }

  // Adapted for Vite using import.meta.env
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Please add them to .env.local"
    );
    // Return a dummy client so the UI doesn't crash completely while you're setting keys up.
    // Ensure you throw or handle this gracefully in production.
  }

  // Create the browser client specific to SSR package
  client = createBrowserClient(supabaseUrl || "", supabaseAnonKey || "");
  return client;
}
