export interface DiscountInput {
  originalPrice: number;
  discountPercentage?: number;
  discountEnabled?: boolean;
}

export interface DiscountResult {
  originalPrice: number;
  discountEnabled: boolean;
  discountPercentage: number;
  discountAmount: number;
  finalPrice: number;
}

export function calculateDiscount({
  originalPrice,
  discountPercentage = 0,
  discountEnabled = false,
}: DiscountInput): DiscountResult {
  const safeOriginalPrice = Number.isFinite(originalPrice) ? Math.max(0, Number(originalPrice)) : 0;
  const safePercentage = Number.isFinite(discountPercentage) ? Math.max(0, Number(discountPercentage)) : 0;
  const enabled = Boolean(discountEnabled) && safeOriginalPrice > 0;
  const validPercentage = enabled && safePercentage > 0 && safePercentage <= 90 ? safePercentage : 0;

  const discountAmount = validPercentage > 0 ? safeOriginalPrice * validPercentage / 100 : 0;
  const finalPrice = Math.max(0, safeOriginalPrice - discountAmount);

  return {
    originalPrice: Number(safeOriginalPrice.toFixed(2)),
    discountEnabled: validPercentage > 0,
    discountPercentage: Number(validPercentage.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    finalPrice: Number(finalPrice.toFixed(2)),
  };
}
