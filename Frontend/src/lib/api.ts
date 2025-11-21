import { authService } from "./auth";

const API_BASE = import.meta.env.VITE_BACKEND_URL;

async function request(path: string, options: RequestInit = {}) {
  const token = authService.getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers ?? {}) as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const errorData = await response.json();
      message = errorData?.error || errorData?.message || message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  return response.json();
}

export const api = {
  profile: {
    update: (payload: { userId?: string; fullName?: string; team?: string; role?: string }) =>
      request("/api/profile", {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
  },
  clients: {
    list: (page = 1, limit = 10) =>
      request(`/api/clients?page=${page}&limit=${limit}`),
    create: (payload: { name: string; industry?: string; description?: string }) =>
      request("/api/clients", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    update: (id: string, payload: Record<string, unknown>) =>
      request(`/api/clients/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    get: (id: string) => request(`/api/clients/${id}`),
  },
  stakeholders: {
    list: (page = 1, limit = 10, search = "") =>
      request(
        `/api/stakeholders?page=${page}&limit=${limit}${
          search ? `&search=${encodeURIComponent(search)}` : ""
        }`
      ),
    byClient: (clientId: string) =>
      request(`/api/stakeholders/by-client/${clientId}`),
    create: (payload: {
      clientId: string;
      name: string;
      role?: string;
      email?: string;
      notes?: string;
    }) =>
      request("/api/stakeholders", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    update: (id: string, payload: Record<string, unknown>) =>
      request(`/api/stakeholders/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
  },
  projects: {
    byClient: (clientId: string) =>
      request(`/api/projects/by-client/${clientId}`),
    create: (payload: {
      clientId: string;
      name: string;
      description?: string;
      status?: string;
    }) =>
      request("/api/projects", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    update: (id: string, payload: Record<string, unknown>) =>
      request(`/api/projects/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
  },
  insights: {
    list: (params?: { clientId?: string; limit?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.clientId) searchParams.set("clientId", params.clientId);
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      const query = searchParams.toString();
      return request(`/api/insights${query ? `?${query}` : ""}`);
    },
    create: (payload: {
      clientId: string;
      projectId?: string;
      stakeholderId?: string;
      rawText: string;
    }) =>
      request("/api/insights", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    approve: (id: string) =>
      request(`/api/insights/${id}/approve`, {
        method: "POST",
      }),
  },
  opportunities: {
    list: (page = 1, limit = 10, search = "") =>
      request(
        `/api/opportunities?page=${page}&limit=${limit}${
          search ? `&search=${encodeURIComponent(search)}` : ""
        }`
      ),
    create: (payload: {
      clientId: string;
      insightId?: string;
      title: string;
      description?: string;
      valueEstimate?: string;
    }) =>
      request("/api/opportunities", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    updateStage: (id: string, stage: string) =>
      request(`/api/opportunities/${id}/stage`, {
        method: "POST",
        body: JSON.stringify({ stage }),
      }),
    update: (id: string, payload: Record<string, unknown>) =>
      request(`/api/opportunities/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
  },
  campaigns: {
    list: () => request("/api/campaigns"),
    create: (payload: {
      topic: string;
      description?: string;
      questions?: string[];
      audienceUserIds?: string[];
    }) =>
      request("/api/campaigns", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    respond: (campaignId: string, payload: { rawResponse: string; clientId: string }) =>
      request(`/api/campaigns/${campaignId}/respond`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    responses: (campaignId: string) =>
      request(`/api/campaigns/${campaignId}/responses`),
  },
  tasks: {
    list: (page = 1, limit = 10, search = "") =>
      request(
        `/api/tasks?page=${page}&limit=${limit}${
          search ? `&search=${encodeURIComponent(search)}` : ""
        }`
      ),
    create: (payload: {
      title: string;
      description?: string;
      priority?: string;
      dueDate?: string;
      assignedTo?: string;
      insightId?: string;
      opportunityId?: string;
    }) =>
      request("/api/tasks", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    update: (id: string, payload: Record<string, unknown>) =>
      request(`/api/tasks/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    updateStatus: (id: string, status: string) =>
      request(`/api/tasks/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),
    delete: (id: string) =>
      request(`/api/tasks/${id}`, {
        method: "DELETE",
      }),
  },
  users: {
    list: () => request("/api/users"),
    getById: (id: string) => request(`/api/users/${id}`),
  },
};

