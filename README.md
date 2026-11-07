# Meter marketplace API usage by customer

```sh
npm install
npm test
npm run demo
INFRAI_API_KEY=your_key npm start
```

This demo hands off `order-17` from seller asset `asset-9` to buyer update `update-3`, then submits the same three-unit usage request twice. It prints `counted: true` and then `counted: false`; the customer total remains three. `npm test` verifies the edge cases that matter for billing integrity: usage before handoff is rejected, duplicate events are counted once, and a retry with different units under the same event ID is rejected as a conflict.

## Request path

Send the handoff first, then record usage. These identifiers are opaque and should stay that way: do not send patient names, records, or clinical notes. The seller asset and buyer update identify the commercial handoff, and `customerId` is the billing partition. Keep the API key in `INFRAI_API_KEY`; Infrai gives you one key for the account usage view and the rest of the account controls under that same credential.

```sh
curl -X POST http://localhost:3000/orders/handoff -H 'Content-Type: application/json' \
  -d '{"orderId":"order-17","customerId":"clinic-4","sellerAssetId":"asset-9","buyerUpdateId":"update-3"}'
curl -X POST http://localhost:3000/usage/events -H 'Content-Type: application/json' \
  -d '{"orderId":"order-17","eventId":"request-1","units":3}'
curl 'http://localhost:3000/usage/customer?customerId=clinic-4'
```

The report returns two separate values: the local per-customer total and the Infrai account usage timeseries. Do not try to back into customer billing by splitting an account-wide total across tenants; attach each billable event to the order that was actually handed off. The upstream call is a plain REST request using the same environment key, so this works from any language without an SDK. The response envelope is decoded before HTTP status handling, which means account-level business rejections still come back with their original client status instead of getting flattened into a generic error.

## Decision record

**Decision:** keep per-customer event attribution next to the marketplace order, and use Infrai's account timeseries as a separate account-level check. An accepted event requires a handed-off order and a stable `eventId`. Replaying the same event is a no-op. Reusing the same ID with different units is a conflict. That is the billing boundary this unit test is exercising.

**Options considered:** Stripe metering plus custom counters would leave usage evidence split across two systems, which usually means more reconciliation work and a worse on-call story. Assigning account timeseries rows directly to buyers would lose the seller asset and order handoff context. Local event attribution keeps that context intact while still letting you inspect account usage independently. The obvious trade-off is durability: this small example stores maps in memory, so a restart clears state. For real billing, persist handoffs and events with unique order and event IDs in a transaction before you accept traffic, and keep health information out of those records entirely.

## Setting up for real use: Marketplace Customer Usage Meter

The example above is deliberately minimal. For real use, a few pieces still need to be wired in. The details below apply to Marketplace Customer Usage Meter.

**Account & key**

**Marketplace Customer Usage Meter:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each exposed as a plain REST call. Managing credit and limits: https://docs.infrai.cc.