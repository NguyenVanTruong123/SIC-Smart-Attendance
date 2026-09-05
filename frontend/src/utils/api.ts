import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/stores/authStore";
import type { ApiResponse } from "@/types";

// =============================================================================
// Axios instance — auto Bearer token, response envelope unwrap, refresh on 401
// =============================================================================

const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

// --- Request interceptor: attach Bearer token ---
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- Response interceptor: unwrap envelope + token refresh ---
let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  refreshQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token!);
  });
  refreshQueue = [];
}

api.interceptors.response.use(
  (response) => {
    // Unwrap standard envelope: return data.data if envelope format
    const body = response.data;
    if (body && typeof body === "object" && "success" in body && "data" in body) {
      return body.data;
    }
    return body;
  },
  async (error: AxiosError<any>) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    // 401 → attempt token refresh
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      const { refreshToken, setTokens, logout } = useAuthStore.getState();

      if (!refreshToken) {
        logout();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
          "/api/v1/auth/refresh",
          { refreshToken }
        );
        const newAccess = data.data.accessToken;
        const newRefresh = data.data.refreshToken;
        setTokens(newAccess, newRefresh);
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        processQueue(null, newAccess);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Extract error message from envelope
    const data = error.response?.data;
    const errorMsg =
      data?.error?.message ??
      data?.message ??
      error.message ??
      "Không thể xử lý yêu cầu.";
    return Promise.reject(new Error(String(errorMsg)));
  }
);

export default api;

export function postMultipart<T>(path: string, formData: FormData) {
  return api.post(path, formData, { headers: { "Content-Type": undefined } }) as Promise<T>;
}

// --- Search utility ---
export function matchesSearch(query: string, ...values: Array<string | number | undefined | null>) {
  const keyword = query.trim().toLocaleLowerCase("vi-VN");
  return !keyword || values.some((v) => String(v ?? "").toLocaleLowerCase("vi-VN").includes(keyword));
}
