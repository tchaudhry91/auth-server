import config from '../config';
import User from '../models/user-model';
import {
  ServerError,
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
    });

    if (!dbUser) {
      return Promise.reject(NotFoundError());
    }

    if (!dbUser.subscription || dbUser.subscription.length == 0) {
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
    return Promise.reject(ServerError());
  }
}

module.exports = {
  getUserSubscriptionLevel
};
