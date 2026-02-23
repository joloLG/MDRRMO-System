/**
 * Offline Service for handling requests when app is offline
 * Queues failed requests and retries when connection is restored
 */

interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  timestamp: number;
  retryCount: number;
}

const QUEUE_KEY = 'mdrrmo_offline_queue';
const MAX_RETRIES = 3;

export class OfflineService {
  private static isOnline: boolean = navigator.onLine;
  private static syncInProgress: boolean = false;

  static init(): void {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('[OfflineService] App is online - starting sync');
      this.syncQueuedRequests();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('[OfflineService] App is offline - requests will be queued');
    });

    // Initial sync if online
    if (navigator.onLine) {
      this.syncQueuedRequests();
    }
  }

  /**
   * Check if app is currently online
   */
  static isAppOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Queue a request for later retry
   */
  static queueRequest(url: string, method: string, headers: Record<string, string>, body: string): void {
    const queue = this.getQueue();
    
    const request: QueuedRequest = {
      id: this.generateId(),
      url,
      method,
      headers,
      body,
      timestamp: Date.now(),
      retryCount: 0
    };

    queue.push(request);
    this.saveQueue(queue);
    
    console.log(`[OfflineService] Request queued: ${method} ${url}`);
  }

  /**
   * Fetch with automatic offline queuing
   */
  static async fetchWithOfflineSupport(
    url: string, 
    options: RequestInit = {}
  ): Promise<Response | null> {
    try {
      const response = await fetch(url, options);
      
      // If successful, return response
      if (response.ok) {
        return response;
      }

      // If server error (5xx), queue for retry
      if (response.status >= 500 && response.status < 600) {
        this.queueRequest(
          url,
          options.method || 'GET',
          this.headersToRecord(options.headers),
          options.body as string || ''
        );
        return null;
      }

      return response;
    } catch (error) {
      // Network error - queue for retry
      if (!navigator.onLine || error instanceof TypeError) {
        this.queueRequest(
          url,
          options.method || 'GET',
          this.headersToRecord(options.headers),
          options.body as string || ''
        );
        
        // Return cached response if available (for GET requests)
        if (options.method === 'GET' || !options.method) {
          const cached = await this.getCachedResponse(url);
          if (cached) {
            return new Response(JSON.stringify(cached), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }
        
        return null;
      }
      
      throw error;
    }
  }

  /**
   * Sync all queued requests when back online
   */
  static async syncQueuedRequests(): Promise<void> {
    if (this.syncInProgress || !navigator.onLine) {
      return;
    }

    this.syncInProgress = true;
    const queue = this.getQueue();
    
    if (queue.length === 0) {
      this.syncInProgress = false;
      return;
    }

    console.log(`[OfflineService] Syncing ${queue.length} queued requests`);
    
    const remaining: QueuedRequest[] = [];
    
    for (const request of queue) {
      try {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body || undefined
        });

        if (response.ok) {
          console.log(`[OfflineService] Synced: ${request.method} ${request.url}`);
          
          // Cache successful GET requests
          if (request.method === 'GET') {
            const data = await response.clone().json().catch(() => null);
            if (data) {
              this.cacheResponse(request.url, data);
            }
          }
        } else if (response.status >= 400 && response.status < 500) {
          // Client error - don't retry
          console.log(`[OfflineService] Client error, dropping: ${request.method} ${request.url}`);
        } else {
          // Server error - retry later if under max retries
          request.retryCount++;
          if (request.retryCount < MAX_RETRIES) {
            remaining.push(request);
          }
        }
      } catch (error) {
        // Network error - keep in queue
        remaining.push(request);
      }
    }

    this.saveQueue(remaining);
    this.syncInProgress = false;
    
    // Show notification if requests were synced
    if (queue.length > remaining.length) {
      this.showSyncNotification(queue.length - remaining.length);
    }
  }

  /**
   * Cache API response for offline use
   */
  private static cacheResponse(url: string, data: any): void {
    try {
      const cache: Record<string, any> = JSON.parse(localStorage.getItem('mdrrmo_api_cache') || '{}');
      cache[url] = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem('mdrrmo_api_cache', JSON.stringify(cache));
    } catch (e) {
      console.error('[OfflineService] Failed to cache response', e);
    }
  }

  /**
   * Get cached response if available
   */
  private static async getCachedResponse(url: string): Promise<any | null> {
    try {
      const cache: Record<string, { data: any; timestamp: number }> = 
        JSON.parse(localStorage.getItem('mdrrmo_api_cache') || '{}');
      const cached = cache[url];
      
      if (cached) {
        // Check if cache is less than 24 hours old
        const age = Date.now() - cached.timestamp;
        if (age < 24 * 60 * 60 * 1000) {
          return cached.data;
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Get current queue
   */
  private static getQueue(): QueuedRequest[] {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Save queue to localStorage
   */
  private static saveQueue(queue: QueuedRequest[]): void {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  /**
   * Generate unique ID
   */
  private static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Convert Headers to Record
   */
  private static headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
    const record: Record<string, string> = {};
    
    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        record[key] = value;
      });
    } else if (Array.isArray(headers)) {
      headers.forEach(([key, value]) => {
        record[key] = value;
      });
    } else if (headers) {
      Object.assign(record, headers);
    }
    
    return record;
  }

  /**
   * Show sync notification
   */
  private static showSyncNotification(count: number): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Bulan Emergency App', {
        body: `${count} offline request${count > 1 ? 's' : ''} synced successfully`,
        icon: '/icon.png'
      });
    }
  }

  /**
   * Get queue status for UI
   */
  static getQueueStatus(): { count: number; isOnline: boolean } {
    return {
      count: this.getQueue().length,
      isOnline: navigator.onLine
    };
  }

  /**
   * Clear the queue (use with caution)
   */
  static clearQueue(): void {
    localStorage.removeItem(QUEUE_KEY);
  }
}
