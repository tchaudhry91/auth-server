import KeycloakEnvConfig from '@exlinc/keycloak-passport/configuration';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

// Load whatever's in the .env file
dotenv.config();

export default {
  environment: process.env.NODE_ENV,
  memcachedUrl: process.env.MEMCACHED_URL,
  sessionSecret: process.env.SESSION_SECRET || 'set_me',
  mongo: {
    uri: process.env.DB_URI || 'mongodb://localhost:27017',
    db: process.env.DB_NAME || 'webph2_dev',
    reconnectTimeout: process.env.DB_RECONNECT_TIMEOUT || 5000
  },
  keycloak: new KeycloakEnvConfig({
    host: process.env.KEYCLOAK_HOST || 'https://accounts.exlinc.com',
    realm: process.env.KEYCLOAK_REALM || 'exlinc',
    clientID: process.env.KEYCLOAK_CLIENT_ID || 'exlskills',
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
    callbackURL: process.env.KEYCLOAK_CALLBACK_URL || '/auth/keycloak/callback',
    passReqToCallback: true
  }),

  platform: {
    name: "EXLskills",
    url: "https://exlskills.com",
    supportEmail: 'support@exlskills.com',
    helpCenterUrl: 'https://help.exlskills.com/'
  },

  cookies: {
    domain: process.env.COOKIES_DOMAIN || 'localhost'
  },

  service: {
    port: process.env.SERVICE_PORT || process.env.PORT || 3030
  },

  client: {
    url: process.env.CLIENT_URL || 'http://localhost:4000'
  },

  cors_origin: process.env.CORS_REGEX
    ? [new RegExp(process.env.CORS_REGEX)]
    : [/localhost/, /exlskills.com/, /\.exlskills\.com$/],

  intercom: {
    idVerificationSecret: process.env.IC_SECRET || 'set_me'
  },

  jwt: {
    cookieName: process.env.JWT_COOKIE_NAME || 'token',
    publicKeyFile:
      process.env.JWT_PUB_KEY_FILE ||
      path.join(__dirname, '../config/sample_keys/public_key.pem'),
    privateKeyFile:
      process.env.JWT_PRIV_KEY_FILE ||
      path.join(__dirname, '../config/sample_keys/private_key.pem'),
    publicKeyBase64: process.env.JWT_PUB_KEY_B64 || '',
    privateKeyBase64: process.env.JWT_PRIV_KEY_B64 || ''
  },

  userDataCookieName: process.env.USER_DATA_COOKIE_NAME || 'user_data',

  smtp: nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
    port: process.env.SMTP_PORT || 587,
    requiresAuth: true,
    auth: {
      user: process.env.SMTP_USERNAME || 'apikey',
      pass: process.env.SMTP_PASSWORD || 'set_me'
    }
  }),

  notifications: {
    purchases: {
      to: 'EXLskills Support <support@exlskills.com>'
    },
    email: {
      from: 'EXLskills <no-reply@exlskills.com>'
    }
  },

  demoUser: {
    avatarUrl:
      'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=robohash'
  },

  exlInternalAPI: {
    key: process.env.EXL_INTERNAL_QUERY_API_KEY || 'set_me'
  },

  botManagerAPI: {
    key: process.env.BOT_MANAGER_API_KEY || 'set_me',
    url: process.env.BOT_MANAGER_API_URL || 'http://localhost:2999'
  },

  stripe: require('stripe')(process.env.STRIPE_SECRET_KEY || 'set_me'),

  stripePlans: {
    creditsMetered: {
      defaultCcy: 'USD',
      planIds: {
        'USD': process.env.STRIPE_PLANS_CREDITS_METERED_USD_ID || 'set_me'
      },
      level: process.env.STRIPE_PLANS_CREDITS_METERED_LEVEL || 2000
    }
  },

  logging_level:
    process.env.LOGGING_LEVEL ||
    (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  db_debug_log:
    process.env.DB_DEBUG_LOG ||
    (process.env.NODE_ENV === 'production' ? false : true)
};
