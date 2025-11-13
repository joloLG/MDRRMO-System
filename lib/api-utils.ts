export interface FetchWithRetryOptions extends RequestInit {
  maxRetries?: number;
  retryDelay?: number;
  retryOn?: number[];
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    retryOn = [408, 429, 500, 502, 503, 504],
    ...init
  } = options;

  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(input, {
        ...init,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          ...(init.headers || {}),
        },
      });

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

  throw lastError || new Error(`Failed to fetch after ${maxRetries + 1} attempts`);
}
