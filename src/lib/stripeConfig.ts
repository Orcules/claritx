// Stripe product/price mapping for ClaritX
export const STRIPE_CONFIG = {
  pro: {
    product_id: "prod_UJisTjrvRHsqu9",
    price_id: "price_1TO2zPG2W6QER8MhGrhIPPy2",
    name: "Pro",
    price: 20,
    trial_days: 14,
  },
  credit_packs: [
    {
      product_id: "prod_UJiwnLIAcYp4BK",
      price_id: "price_1TO2zPG2W6QER8MhUJsHaWz2",
      credits: 20,
      price: 5,
      label: "Starter Pack",
      popular: false,
    },
    {
      product_id: "prod_UJiw3DTzlmySHN",
      price_id: "price_1TO2zQG2W6QER8MhBiHP2pwl",
      credits: 50,
      price: 10,
      label: "Power Pack",
      popular: false,
    },
    {
      product_id: "prod_UJiw92XnteYfVA",
      price_id: "price_1TO2zQG2W6QER8MhsaCw6i8k",
      credits: 120,
      price: 20,
      label: "Pro Pack",
      popular: true,
    },
  ],
} as const;
