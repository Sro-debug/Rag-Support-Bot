const BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

// Auth
export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    me: () => request<{ userId: string; email: string; role: string }>("/auth/me"),
    register: (email: string, password: string, role: string) =>
      request("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, role }),
      }),
    users: () => request<any[]>("/auth/users"),
  },

  documents: {
    list: () => request<any[]>("/documents"),
    upload: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return fetch(`${BASE}/documents/upload`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || "Upload failed");
        }
        return res.json();
      });
    },
    delete: (id: string) =>
      request(`/documents/${id}`, { method: "DELETE" }),
  },

  chat: {
    sessions: () => request<any[]>("/chat/sessions"),
    createSession: () =>
      request<any>("/chat/sessions", { method: "POST" }),
    getSession: (id: string) => request<any>(`/chat/sessions/${id}`),
    deleteSession: (id: string) =>
      request(`/chat/sessions/${id}`, { method: "DELETE" }),
  },
};

// Streaming chat — returns EventSource-style via fetch ReadableStream
export async function streamMessage(
  sessionId: string,
  message: string,
  onToken: (token: string) => void,
  onSources: (sources: any[]) => void,
  onDone: () => void,
  onError: (err: string) => void
): Promise<void> {
  const res = await fetch(`${BASE}/chat/sessions/${sessionId}/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Stream failed" }));
    onError(err.error || "Stream failed");
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6));
        if (event.type === "token") onToken(event.token);
        else if (event.type === "sources") onSources(event.sources);
        else if (event.type === "done") onDone();
      } catch {}
    }
  }
}
