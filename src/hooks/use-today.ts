import { useQuery } from "@tanstack/react-query";
import { getTodaySummary } from "@/lib/tauri";

export function useTodaySummary() {
  return useQuery({
    queryKey: ["today-summary"],
    queryFn: getTodaySummary,
    staleTime: 120_000,
  });
}
