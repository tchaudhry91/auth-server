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
import fs from 'fs';
import path from 'path';

const pixel = fs.readFileSync(path.join(__dirname, '../assets/pixel.gif'))

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

function clearAuthCookies() {
  return [{
      name: config.jwt.cookieName,
      value: '',
      options: {
        expire: new Date(new Date() - 30 * 24 * 60 * 60 * 1000),
        httpOnly: true,
        domain: config.cookies.domain
      }
    },
    {
      name: config.userDataCookieName,
      value: '',
      options: {
        expire: new Date(new Date() - 30 * 24 * 60 * 60 * 1000),
        domain: config.cookies.domain
      }
    }
  ];
}

async function logout() {
  return {
    cookies: clearAuthCookies()
  }
}

async function finalizeKeycloakAuth(user, cookies) {
  const jwtToken = generateToken(user);
  return {
    cookies: getAuthResponseCookies(jwtToken),
    redirect: cookies.kc_lgn_success_redir || config.client.url
  };
}

async function anonymousAccessGIF(req, res, next) {
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
      user = await User.findOne({
        _id: decoded.user_id
      }).exec();
    }
  }

  if (!user) {
    user = await User.createDumpUser();
    const jwtToken = generateToken(user);
    resCookies = getAuthResponseCookies(jwtToken);
  }

  for (let cookie of resCookies) {
    const {
      name,
      value,
      options
    } = cookie;
    res.cookie(name, value, options);
  }

  res.end(pixel);
}

async function jwtRefresh(cookies) {
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
      try {
        user = await User.findOne({
          _id: decoded.user_id
        }).exec();
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

async function anonymousAccess(cookies, redirect) {
  const cookieName = config.jwt.cookieName;
  const existingToken = cookies[cookieName];
  let user;
  if (existingToken) {
    let decoded;
    try {
      decoded = decodeToken(existingToken);
    } catch (error) {}

    if (decoded && decoded.user_id) {
      user = await User.findOne({
        _id: decoded.user_id
      }).exec();
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
  logout,
  jwtRefresh,
  anonymousAccess,
  anonymousAccessGIF,
  intercomUserHash,
  finalizeKeycloakAuth
};
