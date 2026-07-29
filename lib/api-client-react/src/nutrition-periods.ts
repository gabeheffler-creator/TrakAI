/**
 * Custom (non-generated) React hooks for program nutrition periods.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface NutritionPeriod {
  id: number;
  programId: number;
  startDate: string;
  endDate: string;
  label?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  createdAt: string;
}

export interface NutritionPeriodInput {
  startDate: string;
  endDate: string;
  label?: string;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
}

export function getListNutritionPeriodsQueryKey(programId: number) {
  return ["programs", programId, "nutrition-periods"] as const;
}

export function useListNutritionPeriods(programId: number) {
  return useQuery<NutritionPeriod[]>({
    queryKey: getListNutritionPeriodsQueryKey(programId),
    queryFn: () =>
      customFetch<NutritionPeriod[]>(
        `/api/programs/${programId}/nutrition-periods`,
        { method: "GET" }
      ),
    enabled: !!programId,
  });
}

export function useCreateNutritionPeriod() {
  return useMutation<
    NutritionPeriod,
    unknown,
    { programId: number; data: NutritionPeriodInput }
  >({
    mutationFn: ({ programId, data }) =>
      customFetch<NutritionPeriod>(
        `/api/programs/${programId}/nutrition-periods`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }
      ),
  });
}

export function useUpdateNutritionPeriod() {
  return useMutation<
    NutritionPeriod,
    unknown,
    { programId: number; periodId: number; data: NutritionPeriodInput }
  >({
    mutationFn: ({ programId, periodId, data }) =>
      customFetch<NutritionPeriod>(
        `/api/programs/${programId}/nutrition-periods/${periodId}`,
        { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }
      ),
  });
}

export function useDeleteNutritionPeriod() {
  return useMutation<
    void,
    unknown,
    { programId: number; periodId: number }
  >({
    mutationFn: ({ programId, periodId }) =>
      customFetch<void>(
        `/api/programs/${programId}/nutrition-periods/${periodId}`,
        { method: "DELETE" }
      ),
  });
}
