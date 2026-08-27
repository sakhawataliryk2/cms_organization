/** True on Vercel serverless — custom undici dispatchers break fetch there. */
function isVercelRuntime(): boolean {
  return (
    process.env.VERCEL === "1" ||
    String(process.env.VERCEL || "").trim().toLowerCase() === "true"
  );
}

/** Backend Express base URL — prefer 127.0.0.1 on AWS to skip IPv6/DNS latency. */
export function getApiBaseUrl(): string {
  const raw = process.env.API_BASE_URL || "http://127.0.0.1:8080";
  return raw.replace("://localhost", "://127.0.0.1").replace(/\/$/, "");
}

/**
 * Fetch the Express API from Next.js proxy routes.
 * Uses plain fetch on Vercel (undici Agent causes UND_ERR_INVALID_ARG in serverless).
 * Optional keep-alive on long-running AWS when undici is available and compatible.
 */
export async function backendFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const base = getApiBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const options: RequestInit = {
    ...init,
    cache: init.cache ?? "no-store",
  };

  if (!isVercelRuntime()) {
    try {
      const { Agent } = await import("undici");
      type UndiciInit = RequestInit & { dispatcher?: InstanceType<typeof Agent> };
      const globalKey = "__cmsBackendUndiciAgent__" as const;
      const g = globalThis as typeof globalThis & {
        [globalKey]?: InstanceType<typeof Agent>;
      };
      if (!g[globalKey]) {
        g[globalKey] = new Agent({
          connections: 64,
          pipelining: 1,
          keepAliveTimeout: 60_000,
          keepAliveMaxTimeout: 600_000,
        });
      }
      (options as UndiciInit).dispatcher = g[globalKey];
    } catch {
      /* plain fetch fallback */
    }
  }

  return fetch(url, options);
}

export async function readBackendJson<T = unknown>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}
