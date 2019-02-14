import http from 'http';
import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import connectMemcached from 'connect-memcached';
import config from './config';
import passport from 'passport';
import cors from 'cors';
import KeycloakStrategy from '@exlinc/keycloak-passport';
import User from './models/user-model';
import databases from './databases';
import routes from './routes';
import { decodeToken } from './helpers/jwt';
import { decode } from 'punycode';
import { generateGravatarUrlForEmail } from './helpers/gravatar';
import { logger } from './utils/logger';

const PORT = config.service.port;

const app = express();
const server = http.createServer(app);

const MemcachedStore = connectMemcached(session);

var sessionConfig = {
  resave: false,
  saveUninitialized: false,
  secret: config.sessionSecret,
  signed: true
};

if (config.environment === 'production') {
  logger.debug(`activating Memcached`);
  sessionConfig.store = new MemcachedStore({
    hosts: [config.memcachedUrl],
    prefix: config.memcachedPrefix
  });
  sessionConfig.key = 'authsess';
  sessionConfig.proxy = true;
}

app.use(session(sessionConfig));

// Hey you! care about my order http://stackoverflow.com/a/16781554/2034015

app.use(
  cors({
    origin: config.cors_origin,
    credentials: true
  })
);

// Databases.
databases.mongodb();

// Cookies.
app.use(cookieParser());

// Body.
app.use(
  bodyParser.urlencoded({
    extended: false
  })
);
app.use(bodyParser.json());

// Passport.
app.use(passport.initialize());
app.use(passport.session());

// Session serializers
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

passport.use(
  'keycloak',
  new KeycloakStrategy(
    config.keycloak,
    async (req, accessToken, refreshToken, profile, done) => {
      let userId = null;
      if (req.cookies && req.cookies[config.jwt.cookieName]) {
        const decodedTkn = decodeToken(req.cookies[config.jwt.cookieName]);
        if (decodedTkn && decodedTkn.user_id) {
          userId = decodedTkn.user_id;
        }
      }
      // This is called after a successful authentication has been completed
      let user;
      try {
        // method, profile, userId
        user = await User.authenticate(
          'keycloak',
          {
            id: profile.keycloakId,
            email: profile.email,
            avatar: generateGravatarUrlForEmail(profile.email),
            full_name: profile.fullName,
            locale: 'en', // TODO: We don't get a locale from keycloak, so just let this be the default 'en' for now and in the future pull from the request
            payload: profile
          },
          userId
        );
      } catch (saveErr) {
        return done(saveErr, user);
      }
      done(null, user);
    }
  )
);

// URLs.
app.use('/', routes);

server.listen(PORT);
logger.info('-·-·-·-·-·-·-·-·-·-·-·-·-·-·-·-·-·-·-·-·-·-·-');
logger.info(`🌐  API listening on port ${PORT}`);
logger.info('-·-·-·-·-·-·-·-·-·-·-·-·-·-·-·-·-·-·-·-·-·-·-');

module.exports = server;
