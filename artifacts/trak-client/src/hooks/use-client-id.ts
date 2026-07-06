import { useAuth } from "@/contexts/AuthContext";
import { useGetMyClient, getGetMyClientQueryKey } from "@workspace/api-client-react";
import type { ApiError } from "@workspace/api-client-react";

export function useClientId() {
  const { user, loading, logout } = useAuth();

  const { data: client, isLoading, error } = useGetMyClient({
    query: {
      enabled: !!user && !loading,
      queryKey: getGetMyClientQueryKey(),
      retry: false,
    },
  });

  const apiError = error as ApiError<{ code?: string }> | null;
  const isDeactivated = apiError?.status === 403 && apiError.data?.code === "CLIENT_DEACTIVATED";

  return {
    clientId: client?.id ?? null,
    isLoading: loading || (!!user && isLoading),
    isDeactivated,
    clearClientId: logout,
  };
}
