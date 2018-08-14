import config from '../config';
import User from '../models/user-model';
import {
  ForbiddenError,
  BadRequestError,
  NotFoundError
} from '../helpers/server';
import {
  getStringByLocale
} from '../helpers/intl-string';
import {
  getRawDataPartFromToken,
  generateToken,
  decodeToken
} from '../helpers/jwt';
import {
  createNewCustomer,
  updateCustomerCurrencyCode
} from '../zoho/customers';
import {
  createNewSubscriptionPage
} from '../zoho/hosted-pages';
import {
  getDefaultCurrencyCode,
  isAcceptedCurrencyCode
} from '../helpers/currencies';
import {
  isValidPlanCode,
  planCodesToSubscriptionLvl,
  planCodesToParams,
  parseZohoDate
} from '../helpers/zoho-subscriptions';
import {
  createBoosts
} from '../botmanagerapi/create-boosts';

Date.prototype.addDays = function (days) {
  var date = new Date(this.valueOf());
  date.setDate(date.getDate() + days);
  return date;
}

async function zohoPostEvent(apiKey, body) {
  if (apiKey !== config.zoho.eventsApiKey) {
    return Promise.reject(ForbiddenError());
  }
  if (!body) {
    return Promise.reject(BadRequestError());
  }
  const eventData = body.data;
  const eventType = body.event_type;
  if (!eventType || !eventData) {
    return Promise.reject(BadRequestError());
  }
  const eventSubscription = eventData.subscription;
  if (!eventSubscription) {
    return Promise.reject(BadRequestError());
  }
  const customerId = eventSubscription.customer.customer_id;
  const planCode = eventSubscription.plan.plan_code;
  const subStatus = eventSubscription.status;
  const nextBillingDate = parseZohoDate(eventSubscription.next_billing_at);

  if (!isValidPlanCode(planCode)) {
    // This is for an unrelated service then
    console.warn('Received invalid plan code on Zoho Subscriptions webhook. Assuming that this if for another service/application.');
    return {}
  }

  let dbUser = await User.findOne({
    zoho_customer_id: customerId
  });

  if (!dbUser) {
    return Promise.reject(NotFoundError());
  }

  if (eventType === 'subscription_renewed') {
    // When subscriptions renew, we add monthly benefits that expire by the next billing cycle
    try {
      // NOTE: Divide the date difference by 1000 because JS uses milliseconds while the API takes seconds
      await createBoosts(dbUser._id, planCodesToParams[planCode].boostsPerCycle, Math.round((nextBillingDate.getTime() - (new Date()).getTime()) / 1000))
    } catch (error) {
      console.error("ERROR CREATING BOOSTS FOR USER: ", dbUser._id, ". Supposed to add ", planCodesToParams[planCode].boostsPerCycle, " boosts that would expire by ", nextBillingDate, "(", eventSubscription.next_billing_at, "). Error reported: ", error);
    }
  }

  if (subStatus === 'live' || subStatus === 'trial') {
    dbUser.subscription[0].level = planCodesToSubscriptionLvl[planCode]
  } else {
    dbUser.subscription[0].level = 1
  }
  await dbUser.save()
}

async function redirectToHostedPageForSubscription(cookies, planCode, ccy) {
  const tknStr = cookies[config.jwt.cookieName];
  if (!tknStr) {
    return {
      redirect: `/auth/keycloak?redirect=/subscriptions/hostedpages/redirect?planCode=${encodeURIComponent(planCode)}&ccy=${encodeURIComponent(ccy)}`
    }
  }

  let token;
  try {
    token = decodeToken(tknStr);
  } catch (error) {
    return {
      redirect: `/auth/keycloak?redirect=/subscriptions/hostedpages/redirect?planCode=${encodeURIComponent(planCode)}&ccy=${encodeURIComponent(ccy)}`
    }
  }

  if (!token || !token.user_id || !token.email || token.is_demo || !token.is_verified) {
    return {
      redirect: `/auth/keycloak?redirect=/subscriptions/hostedpages/redirect?planCode=${encodeURIComponent(planCode)}&ccy=${encodeURIComponent(ccy)}`
    }
  }

  try {
    let respObj = await createHostedPageForSubscription(cookies, planCode, ccy);
    return {
      redirect: respObj.pageUrl
    }
  } catch (err) {
    return Promise.reject(err)
  }
}

async function createHostedPageForSubscription(cookies, planCode, ccy) {
  const tknStr = cookies[config.jwt.cookieName];
  if (!tknStr) {
    return Promise.reject(ForbiddenError());
  }

  if (!planCode || !isValidPlanCode(planCode)) {
    return Promise.reject(BadRequestError('invalid plan code'));
  }

  if (!ccy) {
    ccy = getDefaultCurrencyCode();
  }

  if (!isAcceptedCurrencyCode(ccy)) {
    return Promise.reject(BadRequestError('invalid ccy code'));
  }

  let token;
  try {
    token = decodeToken(tknStr);
  } catch (error) {
    return Promise.reject(ForbiddenError());
  }

  if (!token || !token.user_id || !token.email || token.is_demo || !token.is_verified) {
    return Promise.reject(ForbiddenError());
  }

  try {
    let dbUser = await User.findOne({
      _id: token.user_id
    });

    if (!dbUser) {
      return Promise.reject(ForbiddenError());
    }

    if (!dbUser.zoho_customer_id) {
      let fullName = getStringByLocale(dbUser.full_name, dbUser.primary_locale).text;
      dbUser.zoho_customer_id = await createNewCustomer(fullName.split(' ').slice(0, -1).join(' '), fullName.split(' ').slice(-1).join(' '), dbUser.primary_email, ccy);
      dbUser.zoho_ccy_code = ccy;
      await dbUser.save();
    } else if (dbUser.zoho_ccy_code != ccy) {
      await updateCustomerCurrencyCode(dbUser.zoho_customer_id, ccy);
      dbUser.zoho_ccy_code = ccy;
      await dbUser.save();
    }

    const pageUrl = await createNewSubscriptionPage(dbUser.zoho_customer_id, planCode);
    return {
      pageUrl
    }
  } catch (err) {
    console.log(err)
    return Promise.reject(BadRequestError())
  }
}

module.exports = {
  redirectToHostedPageForSubscription,
  createHostedPageForSubscription,
  zohoPostEvent
};
