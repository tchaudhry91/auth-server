import twilio from 'twilio';
import PhoneAuthToken from '../models/phone-auth-token-model';
import User from '../models/user-model';
import { decodeToken, generateToken } from "../helpers/jwt";
import config from '../config';
import { logger } from '../utils/logger';
import {
  ForbiddenError,
  BadRequestError,
  InternalServerError
} from '../helpers/server';
import { generateFixedLengthCode } from '../utils/fixed-length-code';
import { selectTwilioNumberForCountry, standardizePhoneNumber } from "../utils/twilio";
import { getAuthResponseCookies } from "./auth";

const twilioClient = new twilio(
  config.twilio.accountSID,
  config.twilio.authToken
);

export async function postSendCode(cookies, phoneNumber, countryIso2) {
  logger.debug(`in postSendCode`);
  const code = generateFixedLengthCode(5);
  if (!phoneNumber || phoneNumber === '') {
    return Promise.reject(BadRequestError('Missing/invalid phone number'));
  }
  try {
    phoneNumber = standardizePhoneNumber(phoneNumber);
  } catch (e) {
    return Promise.reject(BadRequestError('Invalid phone number'));
  }
  let user;
  try {
    user = await User.findById(
      decodeToken(cookies[config.jwt.cookieName]).user_id
    ).exec();
    if (!user) {
      return Promise.reject(ForbiddenError('Valid auth token required'));
    }
  } catch (error) {
    return Promise.reject(ForbiddenError());
  }
  let phoneAuthToken = new PhoneAuthToken({
    user_id: user._id,
    verified: false,
    phone_number: phoneNumber,
    code: code,
    expires_at: new Date(new Date().getTime() + 300000)
  }); // Expires at is now plus 5mins
  try {
    await phoneAuthToken.save();
  } catch (err) {
    Promise.reject(InternalServerError());
  }
  try {
    const msg = await twilioClient.messages.create({
      body: `Your EXLskills Secure Code is ${code}`,
      to: phoneNumber, // Text this number
      from: selectTwilioNumberForCountry(countryIso2 || 'us') // From a valid Twilio number
    });
    logger.debug('Sent twilio message: ' + msg.sid);
  } catch (err) {
    logger.error('Error sending twilio message: ' + err);
    return Promise.reject(InternalServerError());
  }
  return {
    success: true
  };
}

export async function postVerifyCode(cookies, code) {
  logger.debug(`in postVerifyCode`);
  if (!code || code === '') {
    return Promise.reject(BadRequestError('Missing/invalid code'));
  }
  let user;
  try {
    user = await User.findById(
      decodeToken(cookies[config.jwt.cookieName]).user_id
    ).exec();
    if (!user) {
      return Promise.reject(ForbiddenError('Valid auth token required'));
    }
  } catch (error) {
    return Promise.reject(ForbiddenError());
  }
  if (user.phone_number) {
    return Promise.reject(
      BadRequestError(
        'A phone number is already associated with the current user'
      )
    );
  }
  let phoneNumber = null;
  try {
    let codeQuery = PhoneAuthToken.findOne({
      code: code,
      user_id: user._id,
      verified: false
    });
    codeQuery = codeQuery.gt('expires_at', new Date());
    let phoneAuthToken = await codeQuery.exec();
    if (!phoneAuthToken) {
      return Promise.reject(BadRequestError('Invalid/expired code'));
    }
    phoneAuthToken.verified = true;
    await phoneAuthToken.save();
    phoneNumber = phoneAuthToken.phone_number;
  } catch (e) {
    return Promise.reject(BadRequestError('Invalid/expired code'));
  }

  try {
    let matchedUser = await User.findOne({
      phone_number: phoneNumber
    }).exec();
    if (matchedUser) {
      user = matchedUser;
    } else {
      user.phone_number = phoneNumber;
      user.is_demo = false;
      user.is_verified = true;
      await user.save();
    }
    const refreshedJwtToken = generateToken(user);
    console.log(user)
    return {
      cookies: getAuthResponseCookies(refreshedJwtToken),
      success: true,
      promptFullName: !user.full_name || !user.full_name.intlString,
      promptEmail: !user.primary_email || user.primary_email === ''
    };
  } catch (e) {
    return Promise.reject(InternalServerError());
  }
}
