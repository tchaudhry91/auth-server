import KeycloakEnvConfig from '@exlinc/keycloak-passport/configuration';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import timekit from 'timekit-sdk';

// Load whatever's in the .env file
dotenv.config();

// Setup the Timekit SDK
timekit.configure({
  appKey: process.env.TIMEKIT_SK || 'set_me'
});

export default {
  environment: process.env.NODE_ENV,
  memcachedUrl: process.env.MEMCACHED_URL,
  memcachedPrefix: process.env.MEMCACHED_PREFIX || 'prod',
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
    name: 'EXLskills',
    url: 'https://exlskills.com',
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

  getResponseAPI: {
    authToken: process.env.GET_RESPONSE_API_AUTH_TOKEN || 'api-key set_me',
    url: process.env.GET_RESPONSE_API_URL || 'https://api.getresponse.com/v3',
    userIdPropertyId: process.env.GET_RESPONSE_USER_ID_PROP_ID || 'bGMQu',
    campaings: {
      'landing_page_sub_0': '8WFgu',
      'co_get_job_dd_sub_0': '8WF3t',
      'co_get_raise_dd_sub_0': '8WFmQ'
    }
  },

  twilio: {
    accountSID: process.env.TWILIO_ACCOUNT_SID || 'set_me',
    authToken: process.env.TWILIO_AUTH_TOKEN || 'set_me',
    numbers: {
      default: process.env.TWILIO_NUMBER_DEFAULT || '+1set_me',
      countries: {
        in: process.env.TWILIO_NUMBER_IN || '+91set_me',
        us: process.env.TWILIO_NUMBER_US || '+1set_me'
      }
    }
  },

  stripe: require('stripe')(process.env.STRIPE_SECRET_KEY || 'set_me'),

  stripeConnect: {
    // Connect client secret is the same as the global client secret, so no need to introduce a new env var
    clientSecret: process.env.STRIPE_SECRET_KEY || 'set_me',
    clientId: process.env.STRIPE_CONNECT_CLIENT_ID || 'set_me',
    redirectUri: process.env.STRIPE_CONNECT_REDIRECT_URI || 'https://auth-api.exlskills.com/stripe-connect/oauth/callback'
  },
  stripeCredits: {
    defaultCcy: 'USD',
    level: process.env.STRIPE_CREDITS_SUB_LEVEL || 2000
  },

  logging_level:
    process.env.LOGGING_LEVEL ||
    (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  db_debug_log:
    process.env.DB_DEBUG_LOG ||
    (process.env.NODE_ENV === 'production' ? false : true)
};
