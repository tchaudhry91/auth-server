import config from '../config';
import User from '../models/user-model';
import {
  ServerError,
  ForbiddenError,
  BadRequestError
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
  isValidPlanCode
} from '../helpers/zoho-subscriptions';

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
  createHostedPageForSubscription
};
