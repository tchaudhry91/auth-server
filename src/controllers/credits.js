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
    const boostsResult = await getBoosts(decoded.user_id);
    return {
        creditsCount: boostsResult
    };
}

async function purchaseCredits(cookies, nToPurchase) {
    logger.debug(`in purchaseCredits`);
    let user;
    try {
        user = await User.findById(decodeToken(cookies[config.jwt.cookieName]).user_id).exec();
    } catch (error) {
        return Promise.reject(ForbiddenError());
    }
    const custId = user.stripe ? user.stripe.customer_id : null;
    const creditsSubId = user.stripe ? user.stripe.credits_sub_id : null;
    const creditsSubItemId = user.stripe? user.stripe.credits_sub_item_id : null;
    if (!custId || !creditsSubId || !creditsSubItemId) {
        return Promise.reject(ForbiddenError());
    }
    
    try {
        await createBoosts(
            dbUser._id,
            nToPurchase,
            Math.round((new Date().getTime() / 1000) + 31556926 * 999)
        );
        await config.stripe.usageRecords.create(creditsSubItemId, {
            quantity: nToPurchase,
            timestamp: Math.round(new Date().getTime() / 1000)
        });
        const boostsResult = await getBoosts(decoded.user_id);
        return {
            creditsCount: boostsResult
        };
    } catch (err) {
        logger.error("Error purchasing credits: ", err)
        return Promise.reject(InternalServerError());
    }
}

async function enroll(cookies, stripeToken) {
    logger.debug(`in enroll (for credits)`);
    let user;
    try {
        user = await User.findById(decodeToken(cookies[config.jwt.cookieName]).user_id).exec();
    } catch (error) {
        return Promise.reject(ForbiddenError());
    }
    // Check that they have an email (users with emails are automatically not demo users)
    if (!user.primary_email) {
        return Promise.reject(new ServerError(msg ? msg : 'Bad request, user requires a primary_email to enroll in a subscription', 400));
    }
    let custId = user.stripe ? user.stripe.customer_id : null;
    let creditsSubItemId = user.stripe ? user.stripe.credits_sub_item_id : null;
    if (!custId) {
        try {
            const stripeCustomer = await config.stripe.customers.create({
                description: '[EXLskills - ' + user._id + '] ' + user.full_name ? user.full_name : 'No Name Supplied',
                email: user.primary_email,
                source: stripeToken
            });
            custId = stripeCustomer.id;
            // We set it to a wholly new object since if they didn't have a cust ID it's safe to assume that there is no other data
            user.stripe = {
                customer_id: custId
            }
            await user.save();
        } catch (err) {
            logger.error("Error creating/saving stripe customer: ", err);
            return Promise.reject(InternalServerError());
        }   
    }

    if (!creditsSubItemId) {
        try {
            const stripeSub = await config.stripe.subscriptions.create({
                customer: custId,
                items: [
                  {
                    plan: config.stripePlans.creditsMetered.id,
                  },
                ]
            });
            creditsSubItemId = stripeSub.items.data[0].id;
            user.stripe.credits_sub_id = stripeSub.id;
            user.stripe.credits_sub_item_id = creditsSubItemId;
            if (user.subscription[0].level < config.stripePlans.creditsMetered.level) {
                user.subscription[0].level = config.stripePlans.creditsMetered.level;
            }
            await user.save();
        } catch (err) {
            logger.error("Error creating/saving stripe subscription: ", err);
            return Promise.reject(InternalServerError());
        }
    }

    return {success: true}
}

async function unenroll(cookies) {
    logger.debug(`in unenroll (for credits)`);
    let user;
    try {
        user = await User.findById(decodeToken(cookies[config.jwt.cookieName]).user_id).exec();
    } catch (error) {
        return Promise.reject(ForbiddenError());
    }
    const custId = user.stripe ? user.stripe.customer_id : null;
    const creditsSubId = user.stripe ? user.stripe.credits_sub_id : null;
    if (custId && creditsSubId) {
        // Cancel the credit sub and remove it from the user's stripe record
        try {
            await config.stripe.subscriptions.del(creditsSubId);
            user.stripe.credits_sub_id = null;
            user.stripe.credits_sub_item_id = null;
            user.subscription[0].level = 1
            await user.save();
        } catch (err) {
            return Promise.reject(InternalServerError());
        }
    }
    return {success: true}
}

module.exports = {
    getCredits,
    purchaseCredits,
    enroll,
    unenroll
};
