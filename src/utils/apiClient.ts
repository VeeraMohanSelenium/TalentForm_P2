import { APIRequestContext, APIResponse, request } from '@playwright/test';
import { env } from '../config/env';

/**
 * Thin wrapper over Playwright's request context.
 *
 * Its job in this suite is not only to test the API in isolation but to replay
 * UI negative cases against the server. A rule enforced only in the browser is
 * not enforced at all (Study and QA Plan, sections 5.2 and 8.4, risk R-API-01).
 */

/** Every endpoint documented in Doc 3, in one place so the auth sweep can iterate them. */
export const ENDPOINTS = {
  login: '/auth/login',
  applications: '/applications',
  application: (id: string) => `/applications/${id}`,
  client: (id: string) => `/applications/${id}/client`,
  beneficiaries: (id: string) => `/applications/${id}/beneficiaries`,
  documents: (id: string) => `/applications/${id}/documents`,
  validate: (id: string) => `/applications/${id}/validate`,
  submit: (id: string) => `/applications/${id}/submit`,
  status: (id: string) => `/applications/${id}/status`,
  products: '/products',
  product: (id: string) => `/products/${id}`,
  riders: '/riders',
} as const;

/** Endpoints that must reject an unauthenticated caller (TC-API-012, R-API-02). */
export const PROTECTED_ENDPOINTS: string[] = [
  ENDPOINTS.applications,
  ENDPOINTS.application('1'),
  ENDPOINTS.client('1'),
  ENDPOINTS.beneficiaries('1'),
  ENDPOINTS.documents('1'),
  ENDPOINTS.validate('1'),
  ENDPOINTS.submit('1'),
  ENDPOINTS.status('1'),
];

/**
 * Why the API suite does not run against this build.
 *
 * Verified on 2026-09-17: every documented path under /api returns 404 on both
 * lab applications (8081 insurance, 8082 FinServe). Alternate prefixes were
 * checked too — /api/v1, /v1, /rest, .json — all 404. Both applications are
 * server-rendered Laravel; there is no REST surface to test.
 *
 * Document 3 section 3.9 specifies eleven endpoints and validation IDs
 * API-V01 to API-V08, and Document 5 requires eight API tests in the minimum
 * coverage. None of that is achievable on this build. Raised with the mentor as
 * an extension of question Q-05.
 *
 * The tests are left in place and skip with this reason, so they activate
 * unchanged if an API is added.
 */
export const API_UNAVAILABLE_REASON =
  'No REST API on this build: every /api path returns 404 on both lab applications ' +
  '(verified 2026-09-17, including /api/v1, /v1 and /rest prefixes). The application is ' +
  'server-rendered Laravel. Document 3 section 3.9 specifies endpoints that do not exist ' +
  'here — see question Q-05 and the README.';

/**
 * Builds an absolute URL for an endpoint.
 *
 * Playwright's `baseURL` follows WHATWG URL resolution, so a leading-slash path
 * like "/products" resolves against the ORIGIN and silently discards the "/api"
 * prefix — "http://host/api" + "/products" becomes "http://host/products", which
 * is the HTML page, not an API. Endpoints are therefore joined explicitly here.
 */
export function apiUrl(endpoint: string): string {
  const base = env.apiBaseUrl.replace(/\/+$/, '');
  const path = endpoint.replace(/^\/+/, '');
  return `${base}/${path}`;
}

let apiProbe: Promise<boolean> | undefined;

/** Probes once per process whether any API surface exists. */
export function isApiAvailable(): Promise<boolean> {
  if (!apiProbe) {
    apiProbe = (async () => {
      try {
        const ctx = await request.newContext({ ignoreHTTPSErrors: true });
        try {
          for (const endpoint of [ENDPOINTS.products, ENDPOINTS.applications]) {
            const res = await ctx.get(apiUrl(endpoint), { failOnStatusCode: false });
            // A JSON response of any status means something is listening.
            const contentType = res.headers()['content-type'] ?? '';
            if (res.status() !== 404 && contentType.includes('json')) return true;
          }
          return false;
        } finally {
          await ctx.dispose();
        }
      } catch {
        return false;
      }
    })();
  }
  return apiProbe;
}

export class ApiClient {
  private constructor(
    private readonly ctx: APIRequestContext,
    private readonly token?: string,
    /** False when no API surface exists; tests should skip rather than fail. */
    readonly available: boolean = true,
  ) {}

  /** Anonymous client — used to prove endpoints reject unauthenticated callers. */
  static async anonymous(): Promise<ApiClient> {
    const ctx = await request.newContext({ ignoreHTTPSErrors: true });
    return new ApiClient(ctx, undefined, await isApiAvailable());
  }

  /**
   * Authenticated client. Falls back to cookie-based session if no token is
   * returned. When there is no API at all, returns an unavailable client rather
   * than throwing, so tests can skip with a clear reason.
   */
  static async asAgent(
    username = env.agent.username,
    password = env.agent.password,
  ): Promise<ApiClient> {
    const ctx = await request.newContext({ ignoreHTTPSErrors: true });

    if (!(await isApiAvailable())) {
      return new ApiClient(ctx, undefined, false);
    }

    const res = await ctx.post(apiUrl(ENDPOINTS.login), {
      data: { username, password },
      failOnStatusCode: false,
    });

    if (!res.ok()) {
      throw new Error(
        `API login failed for "${username}": ${res.status()} ${res.statusText()}. ` +
          `Body: ${await safeText(res)}`,
      );
    }

    const body = await safeJson(res);
    const token =
      body?.token ?? body?.access_token ?? body?.data?.token ?? body?.data?.access_token;
    return new ApiClient(ctx, typeof token === 'string' ? token : undefined, true);
  }

  /** Reuses an existing browser context's cookies, so UI and API see the same session. */
  static async fromStorageState(storageStatePath: string): Promise<ApiClient> {
    const ctx = await request.newContext({
      baseURL: env.apiBaseUrl,
      storageState: storageStatePath,
      ignoreHTTPSErrors: true,
    });
    return new ApiClient(ctx);
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Accept: 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...extra,
    };
  }

  get(url: string, params?: Record<string, string | number>): Promise<APIResponse> {
    return this.ctx.get(apiUrl(url), { headers: this.headers(), params, failOnStatusCode: false });
  }

  post(url: string, data?: unknown): Promise<APIResponse> {
    return this.ctx.post(apiUrl(url), { headers: this.headers(), data, failOnStatusCode: false });
  }

  put(url: string, data?: unknown): Promise<APIResponse> {
    return this.ctx.put(apiUrl(url), { headers: this.headers(), data, failOnStatusCode: false });
  }

  patch(url: string, data?: unknown): Promise<APIResponse> {
    return this.ctx.patch(apiUrl(url), { headers: this.headers(), data, failOnStatusCode: false });
  }

  delete(url: string): Promise<APIResponse> {
    return this.ctx.delete(apiUrl(url), { headers: this.headers(), failOnStatusCode: false });
  }

  /** Multipart upload, for the documents endpoint. */
  upload(
    url: string,
    field: string,
    file: { name: string; mimeType: string; buffer: Buffer },
    extra: Record<string, string> = {},
  ): Promise<APIResponse> {
    return this.ctx.post(apiUrl(url), {
      headers: this.headers(),
      multipart: { [field]: file, ...extra },
      failOnStatusCode: false,
    });
  }

  async dispose(): Promise<void> {
    await this.ctx.dispose();
  }
}

/** Reads a response body as JSON without throwing on an empty or non-JSON body. */
export async function safeJson(res: APIResponse): Promise<any> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

/** Reads a response body as text, truncated so failure messages stay readable. */
export async function safeText(res: APIResponse, limit = 600): Promise<string> {
  try {
    const t = await res.text();
    return t.length > limit ? `${t.slice(0, limit)}…` : t;
  } catch {
    return '<unreadable body>';
  }
}

/** Serialises a response for attachment as defect evidence (section 8.6). */
export async function describeResponse(res: APIResponse): Promise<string> {
  return [
    `${res.status()} ${res.statusText()}  ${res.url()}`,
    `headers: ${JSON.stringify(res.headers(), null, 2)}`,
    `body: ${await safeText(res, 4000)}`,
  ].join('\n');
}
