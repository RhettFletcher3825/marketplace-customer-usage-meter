import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { accountUsageTimeseries, InfraiError } from "./infrai_usage.ts";
import { handoffBody, MarketplaceMeter, MeterConflict, usageBody } from "./marketplace_policy.ts";

const meter = new MarketplaceMeter();
const key = process.env.INFRAI_API_KEY;

function send(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}

async function body(req: IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 16_384) throw new Error("Request body too large");
  }
  return JSON.parse(raw);
}

export function marketplaceServer(apiKey: string) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (req.method === "POST" && url.pathname === "/orders/handoff") {
        return send(res, 200, meter.handoff(handoffBody.parse(await body(req))));
      }
      if (req.method === "POST" && url.pathname === "/usage/events") {
        return send(res, 200, meter.record(usageBody.parse(await body(req))));
      }
      if (req.method === "GET" && url.pathname === "/usage/customer") {
        const customerId = url.searchParams.get("customerId");
        if (!customerId) return send(res, 400, { error: "customerId required" });
        const accountTimeseries = await accountUsageTimeseries(apiKey);
        return send(res, 200, { customerId, units: meter.total(customerId), accountTimeseries });
      }
      return send(res, 404, { error: "Route not found" });
    } catch (error) {
      if (error instanceof ZodError || error instanceof SyntaxError) return send(res, 400, { error: "Invalid request body" });
      if (error instanceof MeterConflict) return send(res, 409, { error: error.message });
      if (error instanceof InfraiError) {
        return send(res, error.status >= 400 && error.status < 500 ? error.status : 502, { error: error.detail });
      }
      return send(res, 502, { error: "Request could not be completed" });
    }
  });
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  if (!key) throw new Error("Set INFRAI_API_KEY before starting the service");
  const port = Number(process.env.PORT ?? 3000);
  marketplaceServer(key).listen(port, () => console.log(`Meter listening on ${port}`));
}
