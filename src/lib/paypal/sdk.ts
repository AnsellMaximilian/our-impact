export type PayPalCampaignFundingSdkConfig = {
  src: string;
  dataMerchantId?: string;
};

export function buildPayPalCampaignFundingSdkConfig({
  clientId,
  currency,
  merchantIds,
}: {
  clientId: string;
  currency: string;
  merchantIds: string[];
}): PayPalCampaignFundingSdkConfig {
  const uniqueMerchantIds = [
    ...new Set(merchantIds.map((merchantId) => merchantId.trim()).filter(Boolean)),
  ];

  if (uniqueMerchantIds.length === 0) {
    throw new Error("At least one PayPal merchant ID is required.");
  }

  const queryMerchantId =
    uniqueMerchantIds.length === 1 ? uniqueMerchantIds[0] : "*";
  const src =
    `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}` +
    `&merchant-id=${encodeURIComponent(queryMerchantId)}` +
    `&currency=${encodeURIComponent(currency)}` +
    "&intent=capture&components=buttons";

  return {
    src,
    dataMerchantId:
      uniqueMerchantIds.length > 1 ? uniqueMerchantIds.join(",") : undefined,
  };
}
