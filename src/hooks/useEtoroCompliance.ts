import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api_adapter';

interface EtoroComplianceData {
  countryCode: string | null;
  isRestricted: boolean;
  tier: string;
  riskWarning: string;
  extraDisclaimer: string | null;
}

export function useEtoroCompliance() {
  const { data, isLoading } = useQuery<EtoroComplianceData>({
    queryKey: ['etoro-compliance'],
    queryFn: async () => {
      const { data, error } = await api.functions.invoke('get-user-geo');
      if (error) throw error;
      return data as EtoroComplianceData;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });

  return {
    isRestricted: data?.isRestricted ?? true,
    riskWarning: data?.riskWarning ?? '',
    extraDisclaimer: data?.extraDisclaimer ?? null,
    tier: data?.tier ?? 'banned',
    countryCode: data?.countryCode ?? null,
    isLoading,
  };
}
