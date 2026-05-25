/**
 * lib/order-calculations.ts
 * Server-side only — SINGLE SOURCE OF TRUTH for all payment calculations.
 * ALL order creation/modification paths MUST use recalcOrder() for financial fields.
 * DO NOT import this on the client — it uses service-role patterns.
 *
 * STRICT BUSINESS RULES (SOURCE OF TRUTH):
 *   shopkeeperEarning = subtotal (100% of items total — NO deductions)
 *   agentEarning       = deliveryCharge (100% of delivery charge — NO deductions)
 *   adminEarning       = platformFee (100% of platform fee — NO deductions)
 *   totalAmount        = subtotal + platformFee + deliveryCharge - couponDiscount
 *   Coupon discount cost is ABSORBED by the platform (admin).
 */
import { createServiceClient } from '@/lib/authMiddleware'

export interface PlatformSettings {
  baseDeliveryCharge: number
  perKmCharge: number
  platformFeePercent: number
  minOrderAmount: number
}

export interface RecalcResult {
  subtotal: number
  deliveryCharge: number
  platformFee: number
  totalAmount: number
  shopkeeperEarning: number
  agentEarning: number
  adminEarning: number
}

/** Load platform settings once */
export async function loadPlatformSettings(): Promise<PlatformSettings> {
  const svc = createServiceClient()
  const { data: settings } = await svc
    .from('platform_settings')
    .select('key, value')
    .in('key', ['base_delivery_charge', 'per_km_delivery_charge', 'platform_fee_percent', 'min_order_amount'])

  const map = new Map(settings?.map((s: { key: string; value: string }) => [s.key, s.value]))
  return {
    baseDeliveryCharge: parseFloat(map.get('base_delivery_charge') ?? '30'),
    perKmCharge: parseFloat(map.get('per_km_delivery_charge') ?? '5'),
    platformFeePercent: parseFloat(map.get('platform_fee_percent') ?? '5'),
    minOrderAmount: parseFloat(map.get('min_order_amount') ?? '50'),
  }
}

/**
 * Recalculate all financial fields for an order.
 * subtotal is already validated on the caller side (items × DB prices).
 */
export function recalcOrder(
  subtotal: number,
  deliveryCharge: number,
  platformFeePercent: number,
  existingDiscount = 0
): RecalcResult {
  const platformFee = Math.round((subtotal * platformFeePercent) / 100)
  const totalAmount = Math.max(0, subtotal + deliveryCharge + platformFee - existingDiscount)
  // STRICT: shopkeeper gets 100% of items total
  const shopkeeperEarning = subtotal
  // STRICT: agent gets 100% of delivery charge
  const agentEarning = deliveryCharge
  // STRICT: admin gets only platform fee (coupon cost absorbed by platform)
  const adminEarning = platformFee

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    deliveryCharge: parseFloat(deliveryCharge.toFixed(2)),
    platformFee,
    totalAmount: parseFloat(totalAmount.toFixed(2)),
    shopkeeperEarning: parseFloat(shopkeeperEarning.toFixed(2)),
    agentEarning,
    adminEarning,
  }
}
