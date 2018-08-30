import config from '../config';
import User from '../models/user-model';
import {
  InternalServerError,
  ForbiddenError,
  BadRequestError,
  NotFoundError
} from '../helpers/server';
import { getAllActiveSubscriptionsForCustomer } from '../zoho/subscriptions';
import { addChargeToSubscription } from '../zoho/add-charge';
import { logger } from '../utils/logger';

async function getUserSubscriptionLevel(apiKey, userID) {
  if (!apiKey || apiKey !== config.exlInternalAPI.key) {
    return Promise.reject(ForbiddenError());
  }
  if (!userID) {
    return Promise.reject(BadRequestError());
  }
  try {
    let dbUser = await User.findOne({
      _id: userID
    }).select({ subscription: 1 });

    if (!dbUser) {
      return Promise.reject(NotFoundError());
    }

    if (!dbUser.subscription || dbUser.subscription.length === 0) {
      return {
        subscriptionLevel: 0
      };
    }

    let mostPrivilegedSubscriptionLevel = dbUser.subscription[0].level;

    dbUser.subscription.forEach(element => {
      if (element.level > mostPrivilegedSubscriptionLevel) {
        mostPrivilegedSubscriptionLevel = element.level;
      }
    });

    return {
      subscriptionLevel: mostPrivilegedSubscriptionLevel
    };
  } catch (error) {
    return Promise.reject(new ServerError());
  }
}

async function addChargeToUser(apiKey, userID, reqObj) {
  const { chargeAmtUSD, chargeDescription } = reqObj;
  if (!apiKey || apiKey !== config.exlInternalAPI.key) {
    return Promise.reject(ForbiddenError());
  }
  if (!userID) {
    return Promise.reject(BadRequestError());
  }
  try {
    let dbUser = await User.findOne({
      _id: userID
    }).select({ subscription: 1, zoho_customer_id: 1 });

    if (!dbUser) {
      return Promise.reject(NotFoundError());
    }

    if (!dbUser.subscription || dbUser.subscription.length === 0) {
      return {
        subscriptionLevel: 0
      };
    }

    let mostPrivilegedSubscriptionLevel = dbUser.subscription[0].level;

    dbUser.subscription.forEach(element => {
      if (element.level > mostPrivilegedSubscriptionLevel) {
        mostPrivilegedSubscriptionLevel = element.level;
      }
    });

    if (mostPrivilegedSubscriptionLevel < 1000) {
      return Promise.reject(BadRequestError());
    }

    if (!dbUser.zoho_customer_id) {
      return Promise.reject(BadRequestError());
    }

    const activeSubs = await getAllActiveSubscriptionsForCustomer(
      dbUser.zoho_customer_id
    );
    if (!activeSubs || activeSubs.length < 1) {
      return Promise.reject(BadRequestError());
    }

    const invoice = await addChargeToSubscription(
      activeSubs[0].subscription_id,
      chargeAmtUSD,
      chargeDescription
    );
    return {
      invoiceId: invoice.invoice_id
    };
  } catch (error) {
    logger.error(error);
    return Promise.reject(InternalServerError());
  }
}

module.exports = {
  getUserSubscriptionLevel,
  addChargeToUser
};
