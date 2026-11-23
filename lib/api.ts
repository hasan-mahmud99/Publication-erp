import { handleMockRequest, generateMockBlob } from './mock-service';

export function getToken(): string | null {
  if (typeof window === 'undefined') return 'demo-standalone-token';
  let token = localStorage.getItem('publishing_erp_token');
  if (!token) {
    token = 'demo-standalone-token';
    localStorage.setItem('publishing_erp_token', token);
  }
  return token;
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  // If remote API is explicitly configured and not localhost, try network fetch first
  const remoteApi = process.env.NEXT_PUBLIC_API_URL;
  if (remoteApi && !remoteApi.includes('localhost') && !remoteApi.includes('127.0.0.1')) {
    try {
      const token = getToken();
      const headers = new Headers(options.headers);
      headers.set('Content-Type', 'application/json');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      const response = await fetch(`${remoteApi}${path}`, { ...options, headers, cache: 'no-store' });
      if (response.ok) {
        return (await response.json()) as T;
      }
    } catch {
      // Fallback to mock service
    }
  }

  // Standalone client-side & edge mock response
  const mockRes = handleMockRequest(path, options);
  if (mockRes.status >= 400) {
    const errorMsg = (mockRes.data as any)?.error?.message || `Request failed (${mockRes.status})`;
    throw new Error(errorMsg);
  }

  return mockRes.data as T;
}

export async function apiFile(path: string): Promise<Blob> {
  const remoteApi = process.env.NEXT_PUBLIC_API_URL;
  if (remoteApi && !remoteApi.includes('localhost') && !remoteApi.includes('127.0.0.1')) {
    try {
      const token = getToken();
      const response = await fetch(`${remoteApi}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store'
      });
      if (response.ok) return await response.blob();
    } catch {
      // Fallback
    }
  }

  return generateMockBlob(path);
}
