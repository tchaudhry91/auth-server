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
    const creditsSubId = dbUser.stripe ? dbUser.stripe.credits_sub_id : null;
    const creditsSubItemId = dbUser.stripe
      ? dbUser.stripe.credits_sub_item_id
      : null;
    if (!custId || !creditsSubId || !creditsSubItemId) {
      return Promise.reject(ForbiddenError());
    }
    await config.stripe.usageRecords.create(creditsSubItemId, {
      quantity: purchaseN,
      timestamp: Math.round(new Date().getTime() / 1000)
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
