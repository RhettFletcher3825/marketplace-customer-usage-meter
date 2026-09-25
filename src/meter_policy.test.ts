import assert from "node:assert/strict";
import { test } from "node:test";
import { MarketplaceMeter, MeterConflict, usageBody } from "./marketplace_policy.ts";

test("only handed-off orders count, and retries do not double bill", () => {
  const meter = new MarketplaceMeter();
  const usage = { orderId: "order-17", eventId: "request-1", units: 3 };
  assert.throws(() => meter.record(usage), MeterConflict);
  meter.handoff({ orderId: "order-17", customerId: "clinic-4", sellerAssetId: "asset-9", buyerUpdateId: "update-3" });
  assert.deepEqual(meter.record(usage), { customerId: "clinic-4", units: 3, counted: true });
  assert.deepEqual(meter.record(usage), { customerId: "clinic-4", units: 3, counted: false });
  assert.equal(meter.total("clinic-4"), 3);
  assert.throws(() => meter.record({ ...usage, units: 4 }), MeterConflict);
  assert.equal(meter.total("clinic-4"), 3);
  assert.equal(usageBody.safeParse({ ...usage, units: -1 }).success, false);
});
