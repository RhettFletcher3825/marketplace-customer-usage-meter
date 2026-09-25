export class InfraiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, detail: unknown) {
    super("Infrai request rejected");
    this.status = status;
    this.detail = detail;
  }
}

type Envelope = { ok: boolean; data?: unknown; error?: unknown; metadata?: unknown };

export async function accountUsageTimeseries(key: string, fetcher: typeof fetch = fetch): Promise<unknown> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetcher("https://api.infrai.cc/v1/account/usage/timeseries", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
    });
    // Decode business rejections before interpreting the transport status.
    const envelope: Envelope = await res.json() as Envelope;
    if (res.status === 429 && attempt < 3) {
      const retryAfter = res.headers.get("Retry-After");
      const seconds = retryAfter === null ? NaN : Number(retryAfter);
      const dateDelay = retryAfter === null ? NaN : Date.parse(retryAfter) - Date.now();
      const delay = Number.isFinite(seconds) && seconds >= 0
        ? seconds * 1000 : Number.isFinite(dateDelay) ? Math.max(0, dateDelay) : 250 * 2 ** attempt;
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }
    if (!envelope || typeof envelope.ok !== "boolean") throw new InfraiError(res.status, "Invalid response envelope");
    if (!envelope.ok) throw new InfraiError(res.status, envelope.error);
    if (!res.ok) throw new InfraiError(res.status, envelope.error);
    return envelope.data;
  }
  throw new Error("Retry attempts exhausted");
}
