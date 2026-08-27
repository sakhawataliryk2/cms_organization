import { Agent } from "undici";

let dispatcher: Agent | undefined;

function getDispatcher(): Agent {
  if (!dispatcher) {
    dispatcher = new Agent({
      connections: 64,
      pipelining: 1,
      keepAliveTimeout: 60_000,
      keepAliveMaxTimeout: 600_000,
    });
  }
  return dispatcher;
}

/** Backend Express base URL — prefer 127.0.0.1 on AWS to skip IPv6/DNS latency. */
export function getApiBaseUrl(): string {
  const raw = process.env.API_BASE_URL || "http://127.0.0.1:8080";
  return raw.replace("://localhost", "://127.0.0.1").replace(/\/$/, "");
}

/**
 * Fetch the Express API with a shared keep-alive connection pool.
 * Use for all Next.js → Express proxy routes on AWS (avoids new TCP per request).
 */
export async function backendFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const base = getApiBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;

  return fetch(url, {
    ...init,
    cache: init.cache ?? "no-store",
    // undici keep-alive dispatcher (Node 18+)
    dispatcher: getDispatcher(),
  } as RequestInit);
}

export async function readBackendJson<T = unknown>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}
