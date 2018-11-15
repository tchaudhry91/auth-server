import config from '../config';
import User from '../models/user-model';
import {
  ForbiddenError,
  BadRequestError,
  InternalServerError,
  NotFoundError,
  ServerError
} from '../helpers/server';
import { getStringByLocale } from '../helpers/intl-string';
import { decodeToken } from '../helpers/jwt';
import { getBoosts } from '../botmanagerapi/get-boosts';
import { createBoosts } from '../botmanagerapi/create-boosts';
import { logger } from '../utils/logger';

async function getCredits(cookies) {
  logger.debug(`in getCredits`);
  const tkn = cookies[config.jwt.cookieName];
  let decoded;
  try {
    decoded = decodeToken(tkn);
  } catch (error) {
    return Promise.reject(ForbiddenError());
  }
  try {
    const boostsResult = await getBoosts(decoded.user_id);
    return {
      creditsCount: boostsResult
    };
  } catch (err) {
    logger.error('Error getting credits: ' + err);
    return Promise.reject(InternalServerError());
  }
}

async function purchaseCredits(cookies, nToPurchase) {
  logger.debug(`in purchaseCredits`);
  let user;
  try {
    user = await User.findById(
      decodeToken(cookies[config.jwt.cookieName]).user_id
    ).exec();
  } catch (error) {
    return Promise.reject(ForbiddenError());
  }
  nToPurchase = parseFloat(nToPurchase);
  if (isNaN(nToPurchase)) {
    return Promise.reject(BadRequestError());
  }
  if (nToPurchase < 1) {
    return Promise.reject(BadRequestError());
  }
  // Note: Make sure we have precision to hundredths at most
  nToPurchase = Math.round(nToPurchase * 100) / 100;
  const custId = user.stripe ? user.stripe.customer_id : null;
  const cardSaved = user.stripe ? user.stripe.card_saved : null;
  let prefCCY = user.stripe ? user.stripe.preferred_ccy : null;
  if (!custId || !cardSaved) {
    return Promise.reject(ForbiddenError());
  }
  if (!!prefCCY) {
    prefCCY = 'USD';
  }

  try {
    await createBoosts(user._id, nToPurchase, 31556926 * 99);
    await config.stripe.charges.create({
      currency: prefCCY,
      amount: Math.round(nToPurchase * 100), // NOTE: Stripe doesn't take floats, so we need to multiply 100 and then do a round to make sure it's an int
      customer: custId
    });
    const boostsResult = await getBoosts(user._id);
    return {
      creditsCount: boostsResult
    };
  } catch (err) {
    logger.error('Error purchasing credits: ' + err);
    return Promise.reject(InternalServerError());
  }
}

async function enroll(cookies, stripeToken, ccy) {
  logger.debug(`in enroll (for credits)`);
  let user;
  try {
    user = await User.findById(
      decodeToken(cookies[config.jwt.cookieName]).user_id
    ).exec();
  } catch (error) {
    return Promise.reject(ForbiddenError());
  }
  if (!stripeToken || !stripeToken.token || !stripeToken.token.id) {
    return Promise.reject(BadRequestError());
  }

  if (!ccy) {
    ccy = config.stripeCredits.defaultCcy;
  }

  // Check that they have an email (users with emails are automatically not demo users)
  if (!user.primary_email) {
    return Promise.reject(
      new ServerError(
        msg
          ? msg
          : 'Bad request, user requires a primary_email to enroll in a subscription',
        400
      )
    );
  }
  let custId = user.stripe ? user.stripe.customer_id : null;
  let cardSaved = user.stripe ? user.stripe.card_saved : null;
  logger.debug('custId ' + custId);
  logger.debug('cardSaved ' + cardSaved);
  if (!custId) {
    logger.debug('about to create a customer');
    try {
      const descUserField = getStringByLocale(user.full_name, 'en').text
        ? getStringByLocale(user.full_name, 'en').text
        : 'No Name Supplied';
      const stripeCustomer = await config.stripe.customers.create({
        description: '[EXLskills - ' + user._id + '] ' + descUserField,
        email: user.primary_email,
        source: stripeToken.token.id
      });
      logger.debug('returned from creating a customer');
      custId = stripeCustomer.id;
      // We set it to a wholly new object since if they didn't have a cust ID it's safe to assume that there is no other data
      user.stripe = {
        customer_id: custId,
        preferred_ccy: ccy,
        card_saved: true
      };
      await user.save();
      cardSaved = true;
    } catch (err) {
      logger.error('Error creating/saving stripe customer: ' + err);
      return Promise.reject(InternalServerError());
    }
  }

  if (!cardSaved) {
    try {
      const stripeSub = await config.stripe.customers.update(custId, {
        source: stripeToken.token.id
      });
      user.stripe.preferred_ccy = ccy;
      user.stripe.card_saved = true;
      if (user.subscription[0].level < config.stripeCredits.level) {
        user.subscription[0].level = config.stripeCredits.level;
        user.markModified('subscription');
      }
      await user.save();
    } catch (err) {
      logger.error('Error creating/saving stripe credit card: ' + err);
      return Promise.reject(InternalServerError());
    }
  }

  return { success: true };
}

async function unenroll(cookies) {
  logger.debug(`in unenroll (for credits)`);
  let user;
  try {
    user = await User.findById(
      decodeToken(cookies[config.jwt.cookieName]).user_id
    ).exec();
  } catch (error) {
    return Promise.reject(ForbiddenError());
  }
  const custId = user.stripe ? user.stripe.customer_id : null;
  const cardSaved = user.stripe ? user.stripe.card_saved : null;
  if (custId && cardSaved) {
    try {
      const custCards = await config.stripe.customers.listCards(custId);
      if (custCards && custCards.data && custCards.data.length) {
        for (let custCard of custCards.data) {
          await config.stripe.customers.deleteCard(custId, custCard.id);
        }
      }
      user.stripe.card_saved = false;
      user.subscription[0].level = 1;
      user.markModified('subscription');
      await user.save();
    } catch (err) {
      console.log(err);
      return Promise.reject(InternalServerError());
    }
  }
  return { success: true };
}

async function membershipStatus(cookies) {
  logger.debug(`in membershipStatus (for credits)`);
  let user;
  try {
    user = await User.findById(
      decodeToken(cookies[config.jwt.cookieName]).user_id
    ).exec();
  } catch (error) {
    return Promise.reject(ForbiddenError());
  }
  const custId = user.stripe ? user.stripe.customer_id : null;
  const creditsSubId = user.stripe ? user.stripe.credits_sub_id : null;
  const creditsSubItemId = user.stripe ? user.stripe.credits_sub_item_id : null;
  if (custId && creditsSubId && creditsSubItemId) {
    return { enrolled: true };
  } else {
    return { enrolled: false };
  }
}

module.exports = {
  getCredits,
  purchaseCredits,
  enroll,
  unenroll,
  membershipStatus
};
