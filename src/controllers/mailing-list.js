import { logger } from '../utils/logger';
import User from '../models/user-model';
import MailingList from '../models/mailing-list-model';
import { decodeToken } from '../helpers/jwt';
import config from '../config';
import { ForbiddenError, BadRequestError, InternalServerError } from '../helpers/server';
import { validateEmail } from '../utils/email';

export async function subscribeToMailingList(cookies, emailAddr, campaign) {
  logger.debug(`in subscribeToMailingList`);
  logger.debug(decodeToken(cookies[config.jwt.cookieName]).user_id);
  let user;
  try {
    user = await User.findById(
      decodeToken(cookies[config.jwt.cookieName]).user_id
    ).exec();
  } catch (error) {
    return Promise.reject(ForbiddenError());
  }
  if (!emailAddr || !validateEmail(emailAddr)) {
    return Promise.reject(BadRequestError());
  }
  if (!campaign) {
    campaign = '_unknown';
  }

  try {
    MailingList.create({
      user_id: user._id,
      locale: 'en',
      email: emailAddr,
      campaign: campaign
    });
  } catch (error) {
    return Promise.reject(InternalServerError());
  }
  return {
    success: true
  };
}
