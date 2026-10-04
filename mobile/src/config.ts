import { validateConfig } from "@/lib/config-rules";

// Public build-time settings (EXPO_PUBLIC_* are inlined into the app bundle).
// Each must be referenced literally so Expo can inline it.
export const config = validateConfig(
  {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
  __DEV__
);
