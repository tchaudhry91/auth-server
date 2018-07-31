import config from '../config';
import User from '../models/user-model';
import {
  ServerError,
  ForbiddenError
} from '../helpers/server';
import {
  getStringByLocale
} from '../helpers/intl-string';
import {
  getRawDataPartFromToken,
  generateToken,
  decodeToken
} from '../helpers/jwt';
import {
  generateIntercomHash
} from '../helpers/intercom';

function getAuthResponseCookies(token) {
  return [{
      name: config.jwt.cookieName,
      value: token,
      options: {
        expire: new Date(new Date() + 30 * 24 * 60 * 60 * 1000),
        httpOnly: true,
        domain: config.cookies.domain
      }
    },
    {
      name: config.userDataCookieName,
      value: getRawDataPartFromToken(token),
      options: {
        expire: new Date(new Date() + 30 * 24 * 60 * 60 * 1000),
        domain: config.cookies.domain
      }
    }
  ];
}

async function finalizeKeycloakAuth(user, cookies) {
  const jwtToken = generateToken(user);
  return {
    cookies: getAuthResponseCookies(jwtToken),
    redirect: cookies.kc_lgn_success_redir || config.client.url
  };
}

async function anonymousAccess(cookies, redirect) {
  const cookieName = config.jwt.cookieName;
  const existingToken = cookies[cookieName];
  let user;
  if (existingToken) {
    let decoded;
    try {
      decoded = decodeToken(existingToken);
    } catch (error) {}

    if (decoded && decoded._id) {
      user = await User.findOne({
        _id: decoded._id
      }).exec();
      if (user) {
        console.log('Found user with ID:', user._id);
      }
    }
  }

  let response = {
    status: 'OK',
    redirect
  };
  if (!user) {
    user = await User.createDumpUser();
    const jwtToken = generateToken(user);
    response.cookies = getAuthResponseCookies(jwtToken);
  }

  response.user = {
    user_id: user._id,
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

async function intercomUserHash(cookies) {
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

module.exports = {
  anonymousAccess,
  intercomUserHash,
  finalizeKeycloakAuth
};
