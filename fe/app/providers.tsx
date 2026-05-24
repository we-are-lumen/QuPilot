'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toast } from '@heroui/react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0,
            retry: (failureCount, error: any) => {
              // Retry only on network errors or 5xx server errors
              if (failureCount >= 2) return false;
              
              const status = error?.response?.status;
              // Network error (no response) or 5xx error
              if (!status || (status >= 500 && status < 600)) {
                return true;
              }
              return false;
            },
          },
          mutations: {
            retry: false, // Never retry mutations
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Toast.Provider />
      {children}
    </QueryClientProvider>
  );
}

