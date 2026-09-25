import { z } from "zod";

export const handoffBody = z.object({
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  sellerAssetId: z.string().min(1),
  buyerUpdateId: z.string().min(1),
}).strict();

export const usageBody = z.object({
  orderId: z.string().min(1),
  eventId: z.string().min(1),
  units: z.number().int().positive(),
}).strict();

type Handoff = z.infer<typeof handoffBody>;
type Usage = z.infer<typeof usageBody>;

export class MarketplaceMeter {
  private orders = new Map<string, Handoff>();
  private events = new Map<string, { orderId: string; units: number }>();
  private totals = new Map<string, number>();

  handoff(input: Handoff) {
    const existing = this.orders.get(input.orderId);
    if (existing && (existing.customerId !== input.customerId ||
      existing.sellerAssetId !== input.sellerAssetId ||
      existing.buyerUpdateId !== input.buyerUpdateId)) {
      throw new MeterConflict("Order ID already belongs to another handoff");
    }
    this.orders.set(input.orderId, input);
    return { orderId: input.orderId, status: "handed_off" as const };
  }

  record(input: Usage) {
    const order = this.orders.get(input.orderId);
    if (!order) throw new MeterConflict("Handoff required before usage");
    const prior = this.events.get(input.eventId);
    if (prior && (prior.orderId !== input.orderId || prior.units !== input.units)) {
      throw new MeterConflict("Event ID already has different usage");
    }
    if (!prior) {
      this.events.set(input.eventId, { orderId: input.orderId, units: input.units });
      this.totals.set(order.customerId, (this.totals.get(order.customerId) ?? 0) + input.units);
    }
    return { customerId: order.customerId, units: this.totals.get(order.customerId)!, counted: !prior };
  }

  total(customerId: string) {
    return this.totals.get(customerId) ?? 0;
  }
}

export class MeterConflict extends Error {}
