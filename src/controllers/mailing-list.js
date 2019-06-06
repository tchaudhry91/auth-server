import { logger } from '../utils/logger';
import User from '../models/user-model';
import MailingList from '../models/mailing-list-model';
import { decodeToken } from '../helpers/jwt';
import config from '../config';
import {
  ForbiddenError,
  BadRequestError,
  InternalServerError
} from '../helpers/server';
import { validateEmail } from '../utils/email';
import { createContact } from '../getresponse/create-contact';
import { getStringByLocale } from '../helpers/intl-string';

export async function subscribeToMailingList(
  cookies,
  reqIpAddr,
  emailAddr,
  campaign,
  formUrl
) {
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
  if (!formUrl) {
    formUrl = '_unknown';
  }

  try {
    await MailingList.create({
      user_id: user._id,
      locale: 'en',
      email: emailAddr,
      campaign: campaign,
      form_url: formUrl
    });
  } catch (error) {
    return Promise.reject(InternalServerError());
  }
  if (campaign === '_unknown' || !config.getResponseAPI.campaigns[campaign]) {
    // Nothing else left for us to try
    return {
      success: true
    };
  }
  let userFullName = getStringByLocale(user.full_name).text || '';
  if (userFullName.startsWith('Anonymous')) {
    userFullName = undefined;
  }
  try {
    await createContact(
      config.getResponseAPI.campaigns[campaign],
      user._id,
      emailAddr,
      userFullName,
      reqIpAddr,
      true
    );
  } catch (error) {
    // console.log(error);
    return Promise.reject(InternalServerError());
  }
  return {
    success: true
  };
}
