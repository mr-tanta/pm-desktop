import { useQuery } from "@tanstack/react-query";
import { getDailyTimeSummary, getWeeklyTimeSummary, getTimeStreaks } from "@/lib/tauri";

export function useDailyTimeSummary(date?: string) {
  return useQuery({
    queryKey: ["daily-time-summary", date],
    queryFn: () => getDailyTimeSummary(date),
    staleTime: 60000,
  });
}

export function useWeeklyTimeSummary(weekOffset?: number) {
  return useQuery({
    queryKey: ["weekly-time-summary", weekOffset],
    queryFn: () => getWeeklyTimeSummary(weekOffset),
    staleTime: 60000,
  });
}

export function useTimeStreaks() {
  return useQuery({
    queryKey: ["time-streaks"],
    queryFn: getTimeStreaks,
    staleTime: 300000,
  });
}
