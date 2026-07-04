import { useAuth, useClerk } from "@clerk/react";
import { useGetMyClient, getGetMyClientQueryKey } from "@workspace/api-client-react";
import type { ApiError } from "@workspace/api-client-react";

export function useClientId() {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();

  const { data: client, isLoading, error } = useGetMyClient({
    query: {
      enabled: !!isSignedIn,
      queryKey: getGetMyClientQueryKey(),
      retry: false,
    },
  });

  const clearClientId = () => {
    void signOut();
  };

  const apiError = error as ApiError<{ code?: string }> | null;
  const isDeactivated = apiError?.status === 403 && apiError.data?.code === "CLIENT_DEACTIVATED";

  return {
    clientId: client?.id ?? null,
    isLoading: !!isSignedIn && isLoading,
    isDeactivated,
    clearClientId,
  };
}
