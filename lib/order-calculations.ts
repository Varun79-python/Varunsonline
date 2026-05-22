/**
 * lib/order-calculations.ts
 * Server-side only — shared order pricing logic.
 * Mirrors the same calculation in /api/orders/secure-place/route.ts.
 * DO NOT import this on the client — it uses service-role patterns.
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

/** Haversine distance in km */
export function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
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
  const agentEarning = Math.round(deliveryCharge * 0.8)
  const adminEarning = platformFee + (deliveryCharge - agentEarning)
  // Shopkeeper earns the subtotal (before platform fee; platform fee deducted separately)
  const shopkeeperEarning = subtotal

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
