// Payments have been completely disabled.
export const startCheckout = async () => {
  return { live: false, url: null, message: "Qmark is completely free. No payments accepted." };
};

export const verifyCheckout = async () => {
  return { ok: true, plan: "free", reference: "" };
};
