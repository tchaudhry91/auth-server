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

const newCustomerUrl = getApiUrlForResource('/customers');
const updateCustomerUrlBase = getApiUrlForResource('/customers/');

export async function createNewCustomer(firstName, lastName, email, ccy) {
  if (!firstName || !lastName || !email) {
    return Promise.reject('invalid new customer parameters');
  }
  if (!ccy) {
    ccy = getDefaultCurrencyCode();
  }
  try {
    const {
      data
    } = await zohoApiClient.post(newCustomerUrl, {
      "display_name": String(firstName + ' ' + lastName),
      "first_name": String(firstName),
      "last_name": String(lastName),
      "email": String(email),
      "payment_terms_label": "Due On Receipt",
      "payment_terms": 0,
      "currency_code": ccy ? String(ccy) : getDefaultCurrencyCode(),
      "is_portal_enabled": true
    });
    if (!data || !data.code == 0 || !data.customer) {
      return Promise.reject('failed to create new customer');
    }
    return data.customer.customer_id
  } catch (err) {
    return Promise.reject(err)
  }
}

export async function updateCustomerCurrencyCode(customerId, ccyCode) {
  if (!customerId) {
    return Promise.reject('invalid update customer parameters');
  }
  if (!ccyCode || !isAcceptedCurrencyCode(ccyCode)) {
    return Promise.reject('not accepted currency code');
  }
  try {
    const {
      data
    } = await zohoApiClient.put(updateCustomerUrlBase + customerId, {
      "currency_code": ccyCode ? String(ccyCode) : getDefaultCurrencyCode(),
    });
    if (!data || !data.code == 0 || !data.customer) {
      return Promise.reject('failed to update customer');
    }
    return data.customer.customer_id
  } catch (err) {
    return Promise.reject(err)
  }
}
