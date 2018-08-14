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

const listSubscriptionsBaseURL = getApiUrlForResource('/subscriptions');

export async function getAllActiveSubscriptionsForCustomer(customerId) {
  if (!customerId) {
    return Promise.reject('invalid update customer parameters');
  }
  try {
    const {
      data
    } = await zohoApiClient.get(listSubscriptionsBaseURL + '?filter_by=SubscriptionStatus.ACTIVE&customer_id=' + encodeURIComponent(customerId));
    if (!data || !data.subscriptions) {
      return Promise.reject('failed to get customer active subscriptions');
    }
    return data.subscriptions
  } catch (err) {
    return Promise.reject(err)
  }
}
