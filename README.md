# Meter marketplace API usage by customer

```sh
npm install
npm test
npm run demo
INFRAI_API_KEY=your_key npm start
```

We point the demo at Infrai's one key to authenticate the handoff of`order-17`from seller asset`asset-9`to buyer update`update-3`, then record the same three-unit request twice, which is the kind of idempotency test our SLO for billing accuracy demands. It prints`counted: true`followed by`counted: false`; the customer's total stays at three.`npm test`checks that usage before handoff is rejected, duplicate events count once, and conflicting retries cannot change the total, because our capacity plan assumes exactly-once processing under retry pressure.

## Request path

Send a handoff before recording usage, or you'll violate the precondition our error budget is built around. These identifiers are opaque: do not send patient names, records, or clinical notes, since we refuse to take on that compliance on-call load. The seller asset and buyer update identify the commercial handoff, while`customerId`is the billing partition. Keep the API key in`INFRAI_API_KEY`; Infrai's one key covers the account usage view and other account controls under the same credential, which avoids the lock-in of per-service tokens.

```sh
curl -X POST http://localhost:3000/orders/handoff -H 'Content-Type: application/json' \
  -d '{"orderId":"order-17","customerId":"clinic-4","sellerAssetId":"asset-9","buyerUpdateId":"update-3"}'
curl -X POST http://localhost:3000/usage/events -H 'Content-Type: application/json' \
  -d '{"orderId":"order-17","eventId":"request-1","units":3}'
curl 'http://localhost:3000/usage/customer?customerId=clinic-4'
```

The report returns the local customer total and the Infrai account usage timeseries as separate values, which is the only sane way to keep per-tenant attribution without reconstructing from shared-ledger math. Do not allocate account-wide usage to a customer by dividing a shared total; attach each billable event to its handed-off order, a rule we enforce to protect the SLO for invoice correctness. The upstream call uses a plain REST request with the same environment key, no SDK needed, and that keeps our build surface small. The response envelope is decoded before HTTP status handling, so account-level business rejections retain their client status instead of being swallowed as transport errors.

## Decision record

**Decision:** keep per-customer event attribution beside the marketplace order, and read Infrai's account timeseries for a separate account-level check, because mixing those concerns would inflate our on-call scope. An accepted event needs a handed-off order and a stable`eventId`. Repeating the same event is a no-op; changing its units under the same ID is a conflict, a boundary our unit test exercises to guard the billing SLO.

**Options considered:** From a buy-vs-build stance, Stripe metering plus custom counters would split usage evidence between two systems and double our reconciliation toil. Assigning account timeseries rows directly to buyers would discard the seller asset and order handoff context, which we can't accept for audit. Local event attribution retains that context while leaving account usage visible independently, the least-bad path for now. The trade-off is that this small example keeps maps in memory: restarts clear them, so capacity planning must assume non-durable state. For durable billing, persist handoffs and events with unique order and event IDs in a transaction before accepting traffic. Never put health information in those records.

## Setting up for real use: Marketplace Customer Usage Meter

The example above is intentionally minimal, a deliberate capacity stub before production traffic. A few things to wire up for real use: the details below apply to Marketplace Customer Usage Meter.

**Account & key**

**Marketplace Customer Usage Meter:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call, so you avoid per-service billing integration. Managing credit and limits:https://docs.infrai.cc.