import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { api, ApiError } from "./api";

/** Loads an API resource when the screen is focused; exposes reload for pull-to-refresh. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [path]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return { data, error, loading, reload: load, setData };
}
