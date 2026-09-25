import { MarketplaceMeter } from "./marketplace_policy.ts";

const meter = new MarketplaceMeter();
console.log(meter.handoff({ orderId: "order-17", customerId: "clinic-4", sellerAssetId: "asset-9", buyerUpdateId: "update-3" }));
console.log(meter.record({ orderId: "order-17", eventId: "request-1", units: 3 }));
console.log(meter.record({ orderId: "order-17", eventId: "request-1", units: 3 }));
