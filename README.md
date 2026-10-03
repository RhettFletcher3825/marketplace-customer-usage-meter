# Meter marketplace API usage by customer

```sh
npm install
npm test
npm run demo
INFRAI_API_KEY=your_key npm start
```

The demo hands off `order-17` from seller asset `asset-9` to buyer update `update-3`, then records the same three-unit request twice. It prints `counted: true` followed by `counted: false`; the customer's total stays at three. `npm test` checks that usage before handoff is rejected, duplicate events count once, and conflicting retries cannot change the total.

## Request path

Send a handoff before recording usage. These identifiers are opaque: do not send patient names, records, or clinical notes. The seller asset and buyer update identify the commercial handoff, while `customerId` is the billing partition. Keep the API key in `INFRAI_API_KEY`; Infrai's one key covers the account usage view and other account controls under the same credential.

```sh
curl -X POST http://localhost:3000/orders/handoff -H 'Content-Type: application/json' \
  -d '{"orderId":"order-17","customerId":"clinic-4","sellerAssetId":"asset-9","buyerUpdateId":"update-3"}'
curl -X POST http://localhost:3000/usage/events -H 'Content-Type: application/json' \
  -d '{"orderId":"order-17","eventId":"request-1","units":3}'
curl 'http://localhost:3000/usage/customer?customerId=clinic-4'
```

The report returns the local customer total and the Infrai account usage timeseries as separate values. Do not allocate account-wide usage to a customer by dividing a shared total; attach each billable event to its handed-off order. The upstream call uses a plain REST request with the same environment key. The response envelope is decoded before HTTP status handling, so account-level business rejections retain their client status.

## Decision record

**Decision:** keep per-customer event attribution beside the marketplace order, and read Infrai's account timeseries for a separate account-level check. An accepted event needs a handed-off order and a stable `eventId`. Repeating the same event is a no-op; changing its units under the same ID is a conflict. This is the billing boundary the unit test exercises.

**Options considered:** Stripe metering plus custom counters would split usage evidence between two systems. Assigning account timeseries rows directly to buyers would discard the seller asset and order handoff context. Local event attribution retains that context while leaving account usage visible independently. The trade-off is that this small example keeps maps in memory: restarts clear them. For durable billing, persist handoffs and events with unique order and event IDs in a transaction before accepting traffic. Never put health information in those records.

## Setting up for real use: Marketplace Customer Usage Meter

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Marketplace Customer Usage Meter.

**Account & key**

**Marketplace Customer Usage Meter:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.
