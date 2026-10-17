
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export type ApiOptions = {
  token?: string;
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
};

export async function apiRequest<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json"
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body:
      options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
    signal: options.signal
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `HTTP ${response.status}: ${message.slice(0, 300) || response.statusText}`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function getHealth(signal?: AbortSignal) {
  return apiRequest<unknown>("/health", { signal });
}

export function getKpis(token: string, network = "all") {
  const query = new URLSearchParams({ limit: "100" });
  if (network !== "all") query.set("network_type", network);

  return apiRequest<unknown>(`/api/v1/kpis?${query}`, { token });
}

export function getThresholds(token: string) {
  return apiRequest<unknown>("/api/v1/thresholds", { token });
}

export function getAlerts(token: string) {
  return apiRequest<unknown>("/api/v1/alerts?limit=100", { token });
}

export function getJobs(token: string) {
  return apiRequest<unknown>("/api/v1/jobs", { token });
}

export function getAuditLogs(token: string) {
  return apiRequest<unknown>("/api/v1/audit-logs", { token });
}

export function getLicense(token: string) {
  return apiRequest<unknown>("/api/v1/license", { token });
}

export function resolveAlert(token: string, id: number | string) {
  return apiRequest<unknown>(`/api/v1/alerts/${id}/resolve`, {
    token,
    method: "POST"
  });
}

export function executeJob(token: string, id: number | string) {
  return apiRequest<unknown>(`/api/v1/jobs/${id}/execute`, {
    token,
    method: "POST"
  });
}

export function retryJob(token: string, id: number | string) {
  return apiRequest<unknown>(`/api/v1/jobs/${id}/retry`, {
    token,
    method: "POST"
  });
}

export function createJob(
  token: string,
  payload: {
    name: string;
    job_type: "KPI_REPORT" | "KPI_CHECK" | "ANOMALY_SCAN";
    scheduled_at: string;
  }
) {
  return apiRequest<unknown>("/api/v1/jobs", {
    token,
    method: "POST",
    body: payload
  });
}

export function submitKpi(
  token: string,
  payload: {
    network_type: "PS" | "CS" | "VoLTE";
    metric_name: string;
    value: number;
    unit: string;
    source: string;
    recorded_at: string;
  }
) {
  return apiRequest<unknown>("/api/v1/kpis", {
    token,
    method: "POST",
    body: payload
  });
}
