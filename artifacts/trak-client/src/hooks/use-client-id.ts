import { useAuth, useClerk } from "@clerk/react";
import { useGetMyClient, getGetMyClientQueryKey } from "@workspace/api-client-react";

export function useClientId() {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();

  const { data: client, isLoading } = useGetMyClient({
    query: {
      enabled: !!isSignedIn,
      queryKey: getGetMyClientQueryKey(),
      retry: false,
    },
  });

  const clearClientId = () => {
    void signOut();
  };

  return {
    clientId: client?.id ?? null,
    isLoading: !!isSignedIn && isLoading,
    clearClientId,
  };
}
