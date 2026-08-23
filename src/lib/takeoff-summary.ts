import { sumQuantities } from "@/lib/takeoff-quantity";
import { findUnit, type QuantityDimension } from "@/lib/takeoff-units";

export type SummaryInput = { unit: string; quantity: string; reviewState: string };

export type TakeoffSummaryRow = {
  unit: string;
  dimension: QuantityDimension;
  total: string;
  itemCount: number;
};

const dimensionOrder: QuantityDimension[] = ["volume", "area", "length", "mass", "count", "lump"];

/**
 * Totals of confirmed quantities, grouped strictly by unit.
 *
 * Only confirmed items are totalled, because an unconfirmed quantity has no stated source
 * yet. Units are never merged, not even within one dimension: showing ตัน and กก. as one
 * number would hide which figure the user actually measured.
 */
export function summarizeConfirmedQuantities(items: readonly SummaryInput[]): TakeoffSummaryRow[] {
  const groups = new Map<string, string[]>();

  for (const item of items) {
    if (item.reviewState !== "confirmed") continue;
    const existing = groups.get(item.unit);
    if (existing) existing.push(item.quantity);
    else groups.set(item.unit, [item.quantity]);
  }

  return [...groups.entries()]
    .map(([unit, quantities]) => ({
      unit,
      dimension: findUnit(unit)?.dimension ?? "count",
      total: sumQuantities(quantities),
      itemCount: quantities.length
    }))
    .sort((left, right) => {
      const byDimension = dimensionOrder.indexOf(left.dimension) - dimensionOrder.indexOf(right.dimension);
      return byDimension !== 0 ? byDimension : left.unit.localeCompare(right.unit);
    });
}
