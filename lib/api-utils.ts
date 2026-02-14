export interface FetchWithRetryOptions extends RequestInit {
  maxRetries?: number;
  retryDelay?: number;
  retryOn?: number[];
  skipAuthRefresh?: boolean;
}

// Track if we're already refreshing the session to prevent multiple refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  // If we're already refreshing, return the existing promise
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshResponse = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      if (!refreshResponse.ok) {
        console.error('Session refresh failed:', refreshResponse.status, refreshResponse.statusText);
        // If refresh fails, clear the session
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error refreshing session:', error);
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Check if current user is ER Team (to prevent session expiration redirects)
function isErTeamUser(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const userData = localStorage.getItem('mdrrmo_user');
    if (userData) {
      const user = JSON.parse(userData);
      return user.user_type === 'er_team';
    }
    // Also check ER Team specific storage
    const erTeamSession = localStorage.getItem('er_team_user_data');
    if (erTeamSession) {
      const erUser = JSON.parse(erTeamSession);
      return erUser.user_type === 'er_team';
    }
  } catch {
    // ignore
  }
  return false;
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    retryOn = [401, 403, 408, 429, 500, 502, 503, 504],
    skipAuthRefresh = false,
    ...init
  } = options;

  let lastError: Error | null = null;
  let attempt = 0;
  let shouldRefreshSession = false;

  while (attempt <= maxRetries) {
    try {
      // If we need to refresh the session and it's not skipped
      if (shouldRefreshSession && !skipAuthRefresh) {
        const refreshSuccess = await refreshSession();
        if (!refreshSuccess) {
          // For ER Team, don't redirect to login - let them continue with offline mode
          if (isErTeamUser()) {
            console.log('[ER Team] Session refresh failed, continuing in offline mode');
            // Return a mock response that indicates offline mode
            return new Response(
              JSON.stringify({
                ok: false,
                offline: true,
                message: 'Operating in offline mode - session refresh failed',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }
          // If refresh failed, redirect to login (for non-ER Team users)
          if (typeof window !== 'undefined') {
            window.location.href = '/login?session_expired=1';
          }
          throw new Error('Session expired. Please log in again.');
        }
        shouldRefreshSession = false; // Reset the flag after refresh
      }

      const response = await fetch(input, {
        ...init,
        credentials: 'include', // Always include credentials
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          ...(init.headers || {}),
        },
      });

      // Handle 401 Unauthorized - try to refresh session once
      if (response.status === 401 && !skipAuthRefresh && !shouldRefreshSession) {
        shouldRefreshSession = true;
        attempt++;
        continue;
      }

      // If the response is successful or not in the retry list, return it
      if (response.ok || !retryOn.includes(response.status)) {
        return response;
      }

      // If we should retry, wait for the delay and try again
      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(2, attempt) + Math.random() * 100;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch (error) {
      lastError = error as Error;
      if (attempt >= maxRetries) break;
      
      const delay = retryDelay * Math.pow(2, attempt) + Math.random() * 100;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    
    attempt++;
  }

  // If we have a last error, throw it
  if (lastError) {
    throw lastError;
  }

  throw new Error(`Failed to fetch after ${maxRetries} attempts`);
}
