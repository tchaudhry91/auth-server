import {
  getApiUrlForResource
} from "../helpers/zoho-subscriptions";
import {
  zohoApiClient
} from "./api-client";

const hostedPageNewSubUrl = getApiUrlForResource('/hostedpages/newsubscription')

export async function createNewSubscriptionPage(customerId, planCode) {
  if (!customerId || !planCode) {
    console.log(customerId, planCode);
    return Promise.reject('invalid hosted page parameters');
  }
  try {
    const {
      data
    } = await zohoApiClient.post(hostedPageNewSubUrl, {
      "customer_id": String(customerId),
      "plan": {
        "plan_code": planCode
      }
    });
    if (!data || !data.code == 0 || !data.hostedpage) {
      return Promise.reject('failed to create new hosted page');
    }
    return data.hostedpage.url
  } catch (err) {
    return Promise.reject(err)
  }
}
