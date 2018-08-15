import {
  getApiUrlForResource
} from "../helpers/zoho-subscriptions";
import {
  getDefaultCurrencyCode,
  isAcceptedCurrencyCode
} from "../helpers/currencies";
import {
  zohoApiClient
} from "./api-client";

const subscriptionChargeBaseURL = getApiUrlForResource('/subscriptions/');

export async function addChargeToSubscription(subscriptionId, amtUSD, description) {
  if (!subscriptionId || !amtUSD || !description) {
    return Promise.reject('invalid add charge parameters');
  }
  try {
    const {
      data
    } = await zohoApiClient.post(subscriptionChargeBaseURL + subscriptionId + '/charge', {
      "amount": amtUSD,
      "description": description
    });
    if (!data || !data.code == 0 || !data.invoice) {
      return Promise.reject('failed to add charge to customer');
    }
    return data.invoice
  } catch (err) {
    return Promise.reject(err)
  }
}
