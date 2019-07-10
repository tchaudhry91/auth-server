import { stringify } from 'flatted/cjs';
import config from '../config';
import User from '../models/user-model';
import { ForbiddenError } from '../helpers/server';
import { getStringByLocale } from '../helpers/intl-string';
import {
  getRawDataPartFromToken,
  generateToken,
  decodeToken
} from '../helpers/jwt';
import { generateIntercomHash } from '../helpers/intercom';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

const pixel = fs.readFileSync(path.join(__dirname, '../assets/pixel.gif'));

export function getAuthResponseCookies(token) {
  return [
    {
      name: config.jwt.cookieName,
      value: token,
      options: {
        maxAge: 30 * 24 * 60 * 60 * 12 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' ? true : undefined,
        domain: config.cookies.domain,
        path: '/'
      }
    },
    {
      name: config.userDataCookieName,
      value: getRawDataPartFromToken(token),
      options: {
        maxAge: 30 * 24 * 60 * 60 * 12 * 1000,
        domain: config.cookies.domain,
        path: '/'
      }
    }
  ];
}

export function clearAuthCookies() {
  return [
    {
      name: config.jwt.cookieName,
      value: '',
      options: {
        maxAge: 0,
        httpOnly: true,
        domain: config.cookies.domain
      }
    },
    {
      name: config.userDataCookieName,
      value: '',
      options: {
        maxAge: 0,
        domain: config.cookies.domain
      }
    }
  ];
}

export async function logout() {
  return {
    cookies: clearAuthCookies()
  };
}

export async function finalizeKeycloakAuth(user, cookies) {
  const jwtToken = generateToken(user);
  return {
    cookies: getAuthResponseCookies(jwtToken),
    redirect: cookies.kc_lgn_success_redir || config.client.url
  };
}

export async function anonymousAccessGIF(req, res, next) {
  let resCookies = [];
  const cookieName = config.jwt.cookieName;
  const existingToken = req.cookies[cookieName];
  let user;
  if (existingToken) {
    let decoded;
    try {
      decoded = decodeToken(existingToken);
    } catch (error) {}

    if (decoded && decoded.user_id) {
      // The returned object is not used except to check if it was found
      user = await User.findOne({
        _id: decoded.user_id
      })
        .select({ _id: 1 })
        .exec();
    }
  }

  if (!user) {
    user = await User.createDumpUser();
    const jwtToken = generateToken(user);
    resCookies = getAuthResponseCookies(jwtToken);
  }

  for (let cookie of resCookies) {
    const { name, value, options } = cookie;
    res.cookie(name, value, options);
  }

  res.end(pixel);
}

export async function jwtRefresh(cookies) {
  const existingToken = cookies[config.jwt.cookieName];
  let user;
  if (existingToken) {
    let decoded;
    try {
      decoded = decodeToken(existingToken);
    } catch (error) {
      return Promise.reject(ForbiddenError());
    }

    if (decoded && decoded.user_id) {
      // See generateToken for the list of User fields required
      try {
        user = await User.findOne({
          _id: decoded.user_id
        })
          .select({
            _id: 1,
            phone_number: 1,
            primary_locale: 1,
            primary_email: 1,
            avatar_url: 1,
            full_name: 1,
            username: 1,
            is_demo: 1,
            is_learn_admin: 1,
            has_completed_first_tutorial: 1,
            is_verified: 1,
            subscription: 1
          })
          .exec();
      } catch (error) {
        return Promise.reject(ForbiddenError());
      }
    }
  } else {
    return Promise.reject(ForbiddenError());
  }
  const refreshedJwtToken = generateToken(user);
  return {
    cookies: getAuthResponseCookies(refreshedJwtToken)
  };
}

export async function anonymousAccess(req, cookies, redirect) {
  logger.debug(`In anonymousAccess ` + req.body);
  const cookieName = config.jwt.cookieName;
  const existingToken = cookies[cookieName];
  let user;
  if (existingToken) {
    let decoded;
    try {
      decoded = decodeToken(existingToken);
    } catch (error) {}

    if (decoded && decoded.user_id) {
      // See "resonse" below for the list of User fields required
      user = await User.findOne({
        _id: decoded.user_id
      })
        .select({
          _id: 1,
          full_name: 1,
          phone_number: 1,
          primary_locale: 1,
          avatar_url: 1,
          subscription: 1
        })
        .exec();
    }
  }

  let response = {
    status: 'OK',
    redirect
  };

  if (!user) {
    const userLocale = req.body && req.body.locale ? req.body.locale : 'en';

    user = await User.createDumpUser(userLocale);
    const jwtToken = generateToken(user);
    response.cookies = getAuthResponseCookies(jwtToken);
  }

  response.user = {
    user_id: user._id,
    phone_number: user.phone_number,
    full_name: getStringByLocale(user.full_name, user.primary_locale).text,
    locale: user.primary_locale,
    avatar_url: user.avatar_url,
    is_demo: true,
    subscription: user.subscription,
    is_verified: false,
    has_completed_first_tutorial: false
  };

  return response;
}

export async function intercomUserHash(cookies) {
  const tknStr = cookies[config.jwt.cookieName];
  if (!tknStr) {
    return Promise.reject(ForbiddenError());
  }

  let token;
  try {
    token = decodeToken(tknStr);
  } catch (error) {
    return Promise.reject(ForbiddenError());
  }
  if (!token || !token.user_id) {
    return Promise.reject(ForbiddenError());
  }

  return Promise.resolve({
    userIdHash: generateIntercomHash(token.user_id)
  });
}
