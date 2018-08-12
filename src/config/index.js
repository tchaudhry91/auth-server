import KeycloakEnvConfig from '@exlinc/keycloak-passport/configuration';
import dotenv from 'dotenv';
import path from 'path';

// Load whatever's in the .env file
dotenv.config();

module.exports = {
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

  log: {
    prefix: process.env.LOG_PREFIX || 'api:'
  },

  cookies: {
    domain: process.env.COOKIES_DOMAIN || 'localhost',
  },

  service: {
    port: process.env.SERVICE_PORT || process.env.PORT || 3030,
    domain: process.env.SERVICE_DOMAIN || 'localhost',
    url: process.env.SERVICE_URL || 'http://localhost:3030'
  },

  client: {
    url: process.env.CLIENT_URL || 'http://localhost:4000'
  },

  cors_origin: process.env.CORS_REGEX ? [new RegExp(process.env.CORS_REGEX)] : [/localhost/, /exlskills.com/, /\.exlskills\.com$/],

  intercom: {
    idVerificationSecret: process.env.IC_SECRET || 'set_me'
  },

  jwt: {
    cookieName: process.env.JWT_COOKIE_NAME || 'token',
    publicKeyFile: process.env.JWT_PUB_KEY_FILE || path.join(__dirname, '../config/sample_keys/public_key.pem'),
    privateKeyFile: process.env.JWT_PRIV_KEY_FILE || path.join(__dirname, '../config/sample_keys/private_key.pem'),
    publicKeyBase64: process.env.JWT_PUB_KEY_B64 || '',
    privateKeyBase64: process.env.JWT_PRIV_KEY_B64 || ''
  },

  userDataCookieName: process.env.USER_DATA_COOKIE_NAME || 'user_data',

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
    port: process.env.SMTP_PORT || 25,
    secure: true,
    auth: {
      user: process.env.SMTP_USERNAME || 'apikey',
      pass: process.env.SMTP_PASSWORD || 'set_me'
    }
  },

  demoUser: {
    avatarUrl: "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=robohash"
  },

  exlInternalAPI: {
    key: process.env.EXL_INTERNAL_QUERY_API_KEY || 'set_me'
  },

  zoho: {
    apiBaseUrl: "https://billing.exlinc.com/api/v1/",
    orgId: process.env.ZOHO_ORG_ID || "set_me",
    authToken: process.env.ZOHO_AUTH_TOKEN || "set_me",
    eventsApiKey: process.env.ZOHO_EVENTS_API_KEY || "set_me",
    plans: {
      essentials: {
        level: 3000,
        monthly: {
          planCode: "EXLskills-008"
        },
        annual: {
          planCode: "EXLskills-009"
        }
      },
      professional: {
        level: 5000,
        monthly: {
          planCode: "EXLskills-010"
        },
        annual: {
          planCode: "EXLskills-011"
        }
      },
      business: {
        level: 7000,
        monthly: {
          planCode: "EXLskills-012"
        },
        annual: {
          planCode: "EXLskills-015"
        }
      }
    }
  }
};
