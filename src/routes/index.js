import express from 'express';
import log from '../helpers/log';
import config from '../config';
import passport from 'passport';
import User from '../models/user-model';
import {
  ServerError
} from '../helpers/server';
const controllers = require('../controllers');

const router = express.Router();
const {
  auth,
  subscriptions,
  healthCheck
} = controllers;

/**
 * Handles controller execution and responds to user (API version).
 * This way controllers are not attached to the API.
 * Web socket has a similar handler implementation.
 * @param promise Controller Promise.
 * @param params (req) => [params, ...].
 */
const controllerHandler = (promise, params) => async (req, res, next) => {
  const boundParams = params ? params(req, res, next) : [req, res, next];
  try {
    const result = await promise(...boundParams);
    if (result && result.cookies) {
      for (let cookie of result.cookies) {
        const {
          name,
          value,
          options
        } = cookie;
        res.cookie(name, value, options);
      }
      // delete result.cookies;
    }
    if (result && result.redirect) {
      return res.redirect(result.redirect);
    }
    return res.json(
      result || {
        status: 'OK'
      }
    );
  } catch (error) {
    return res.status(500) && next(error);
  }
};
const c = controllerHandler;

/**
 * Auth.
 */
router.post(
  '/anonymous',
  c(auth.anonymousAccess, req => [req.cookies, req.query.redirect])
);
router.get(
  '/anonymous.gif',
  auth.anonymousAccessGIF
);
router.post(
  '/intercom-user-hash',
  c(auth.intercomUserHash, req => [req.cookies])
);
router.get(
  '/subscriptions/hostedpages',
  c(subscriptions.createHostedPageForSubscription, req => [req.cookies, req.query.planCode, req.query.ccy])
);
router.get(
  '/health-check',
  c(healthCheck.healthCheckIndex, req => [])
);

router.get('/auth/keycloak', (req, res) => {
  if (req.query.redirect) {
    res.cookie('kc_lgn_success_redir', req.query.redirect, {});
  }
  passport.authenticate('keycloak', config.keycloak)(req, res);
});

router.get(
  '/auth/keycloak/callback',
  passport.authenticate('keycloak', config.keycloak),
  c(auth.finalizeKeycloakAuth, req => [req.user, req.cookies])
);

router.post(
  '/me/logout',
  c(auth.logout, req => [req.cookies])
);

router.post(
  '/zoho/subscriptions/events',
  c(subscriptions.zohoPostEvent, req => [req.query.apiKey, req.body])
);

/**
 * Error-handler.
 */
router.use((err, req, res, _next) => {
  // Expected errors always throw ServerError.
  // Unexpected errors will either throw unexpected stuff or crash the application.
  if (Object.prototype.isPrototypeOf.call(ServerError.prototype, err)) {
    return res.status(err.status || 500).json({
      error: err.message
    });
  }

  log.error('~~~ Unexpected error exception start ~~~');
  log.error(err);
  log.error('~~~ Unexpected error exception end ~~~');

  return res.status(500).json({
    error: 'Internal server error'
  });
});

module.exports = router;
