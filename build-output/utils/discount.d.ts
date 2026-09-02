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
export declare function calculateDiscount({ originalPrice, discountPercentage, discountEnabled, }: DiscountInput): DiscountResult;
//# sourceMappingURL=discount.d.ts.map