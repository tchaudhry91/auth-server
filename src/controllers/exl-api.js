import config from '../config';
import User from '../models/user-model';
import {
  InternalServerError,
  ForbiddenError,
  BadRequestError,
  NotFoundError
} from '../helpers/server';
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

async function purchaseCreditsForUser(apiKey, userID, purchaseN) {
  if (!apiKey || apiKey !== config.exlInternalAPI.key) {
    return Promise.reject(ForbiddenError());
  }
  if (!userID || !purchaseN || purchaseN < 1) {
    return Promise.reject(BadRequestError());
  }
  try {
    const dbUser = await User.findOne({
      _id: userID
    }).exec();

    if (!dbUser) {
      return Promise.reject(NotFoundError());
    }

    const custId = dbUser.stripe ? dbUser.stripe.customer_id : null;
    const cardSaved = dbUser.stripe ? dbUser.stripe.card_saved : null;
    let prefCCY = dbUser.stripe ? dbUser.stripe.preferred_ccy : null;
    if (!custId || !cardSaved) {
      return Promise.reject(ForbiddenError());
    }
    if (!!prefCCY) {
      prefCCY = 'USD';
    }
    await config.stripe.charges.create({
      currency: prefCCY,
      amount: purchaseN, // NOTE: Stripe doesn't take floats, so we need to multiply 100 and then do a round to make sure it's an int
      customer: custId
    });
    return {
      success: true
    };
  } catch (error) {
    logger.error('Purchase credits error: ' + error);
    return Promise.reject(InternalServerError());
  }
}

module.exports = {
  getUserSubscriptionLevel,
  purchaseCreditsForUser
};
