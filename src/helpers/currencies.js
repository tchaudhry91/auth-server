export const acceptedCurrencies = {
  "USD": {
    displayName: "US Dollar",
    symbol: "$"
  },
  "EUR": {
    displayName: "Euro",
    symbol: "€"
  }
}

export function isAcceptedCurrencyCode(ccy) {
  return !!acceptedCurrencies[ccy];
}

export function getDefaultCurrencyCode() {
  return "USD";
}
