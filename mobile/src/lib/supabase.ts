import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

import { config } from "@/config";

import { secureSessionStorage } from "./secure-storage";

// Supabase client for the app: publishable key only (RLS always applies).
// Used for sign-in/session refresh and the live cart signal; all business
// operations go through the server API (/api/v1).
export const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
  auth: {
    storage: secureSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is in the foreground.
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
