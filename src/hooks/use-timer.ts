import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getActiveTimer, startTimer, stopTimer, getTimeEntries } from "@/lib/tauri";
import { useAppStore } from "@/stores/app-store";
import { useEffect, useState, useMemo } from "react";

export function useActiveTimer() {
  const setActiveTimer = useAppStore((s) => s.setActiveTimer);
  const [localElapsed, setLocalElapsed] = useState(0);

  const query = useQuery({
    queryKey: ["active-timer"],
    queryFn: getActiveTimer,
    refetchInterval: (query) => (query.state.data ? 30000 : false),
    staleTime: 10000,
  });

  // Calculate elapsed locally between server refreshes
  useEffect(() => {
    if (!query.data) {
      setLocalElapsed(0);
      return;
    }

    // Initialize with server value
    setLocalElapsed(query.data.elapsed_seconds);

    // Update every second locally
    const interval = setInterval(() => {
      setLocalElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [query.data?.started_at]); // Reset when timer starts/stops

  // Sync with server when we get new data
  useEffect(() => {
    if (query.data) {
      setLocalElapsed(query.data.elapsed_seconds);
    }
  }, [query.data?.elapsed_seconds]);

  // Memoized timer with local elapsed
  const timerWithLocalElapsed = useMemo(() => {
    if (!query.data) return null;
    return {
      ...query.data,
      elapsed_seconds: localElapsed,
    };
  }, [query.data, localElapsed]);

  useEffect(() => {
    setActiveTimer(timerWithLocalElapsed);
  }, [timerWithLocalElapsed, setActiveTimer]);

  return {
    ...query,
    data: timerWithLocalElapsed,
  };
}

export function useStartTimer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startTimer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-timer"] });
    },
  });
}

export function useStopTimer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: stopTimer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-timer"] });
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
    },
  });
}

export function useTimeEntries(projectName?: string, limit?: number) {
  return useQuery({
    queryKey: ["time-entries", projectName, limit],
    queryFn: () => getTimeEntries(projectName, limit),
  });
}
