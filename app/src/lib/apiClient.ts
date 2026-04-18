const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<{ data: T | null; error: { message: string } | null }> {
  try {
    const res = await fetch(`${API_URL}${path}`, options)
    if (res.status === 204) return { data: null, error: null }
    const json = await res.json()
    if (!res.ok) {
      return { data: null, error: { message: json.detail || `HTTP ${res.status}` } }
    }
    return { data: json as T, error: null }
  } catch (err: any) {
    return { data: null, error: { message: err.message || "Network error" } }
  }
}

function jsonBody(body: object): RequestInit {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }
}

export const api = {
  markets: {
    list: () => request<any[]>("/markets"),
    get: (id: string) => request<any>(`/markets/${id}`),
    getByInviteCode: (code: string) =>
      request<any>(`/markets/by-invite/${code}`),
    create: (body: object) =>
      request<any>("/markets", { method: "POST", ...jsonBody(body) }),
    update: (id: string, body: object) =>
      request<any>(`/markets/${id}`, { method: "PATCH", ...jsonBody(body) }),
    delete: (id: string) =>
      request<null>(`/markets/${id}`, { method: "DELETE" }),
  },
}
