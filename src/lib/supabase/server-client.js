// NOTE: This functionality is built for Next.js App Router (using next/headers). 
// Since this is a Vite + React Single Page App, importing this file directly 
// will crash Vite because "next/headers" is not an installed dependency.
// It is preserved here per your request for when you build out the backend/Node layer!

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getEnvironmentVariables() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

export async function createSupabaseServerClient() {
  const { supabaseUrl, supabaseAnonKey } = getEnvironmentVariables();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => 
            cookieStore.set(name, value, options)
          );
        } catch(error) {
          console.log(error)
        }
      }
    }
  });
}
