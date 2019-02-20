import express from 'express';
import config from '../config';
import passport from 'passport';
import { ServerError } from '../helpers/server';
import { logger } from '../utils/logger';

const controllers = require('../controllers');

const router = express.Router();
const {
  auth,
  healthCheck,
  exlAPI,
  credits,
  purchase,
  stripeConnect,
  phoneAuth,
  mailingList
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
        const { name, value, options } = cookie;
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
router.get('/anonymous.gif', auth.anonymousAccessGIF);
router.get('/auth/jwt-refresh', c(auth.jwtRefresh, req => [req.cookies]));
router.post(
  '/intercom-user-hash',
  c(auth.intercomUserHash, req => [req.cookies])
);

router.get('/health-check', c(healthCheck.healthCheckIndex, req => []));

router.get(
  '/exl/users/:userId/subscription',
  c(exlAPI.getUserSubscriptionLevel, req => [
    req.query.apiKey,
    req.params.userId
  ])
);

router.post(
  '/exl/users/:userId/credits',
  c(exlAPI.purchaseCreditsForUser, req => [
    req.query.apiKey,
    req.params.userId,
    req.query.purchaseN
  ])
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

router.get('/me/credits', c(credits.getCredits, req => [req.cookies]));
router.post(
  '/me/credits/purchase',
  c(credits.purchaseCredits, req => [req.cookies, req.query.purchaseN])
);
router.post(
  '/me/credits/enroll',
  c(credits.enroll, req => [req.cookies, req.body.stripeToken, req.body.ccy])
);
router.post('/me/credits/unenroll', c(credits.unenroll, req => [req.cookies]));
router.get(
  '/me/credits/membership',
  c(credits.membershipStatus, req => [req.cookies])
);

router.post('/me/logout', c(auth.logout, req => [req.cookies]));

router.post(
  '/purchase',
  c(purchase.purchaseHandler, req => [req.cookies, req.body.payer_user_id, req.body.user_id, req.body.item])
);

router.get(
  '/stripe-connect/oauth/redirect',
  c(stripeConnect.stripeOAuthRedirect, req => [req.cookies, req.query.redirectUrl])
);
router.get(
  '/stripe-connect/oauth/callback',
  c(stripeConnect.stripeOAuthCallback, req => [req.cookies, req.query.code, req.query.state])
);

router.post(
  '/mailing-list',
  c(mailingList.subscribeToMailingList, req => [req.cookies, req.get('X-Forwarded-For') || req.connection.remoteAddress, req.body.email, req.body.campaign, req.body.formUrl])
);

router.post(
  '/auth/phone',
  c(phoneAuth.postSendCode, req => [req.cookies, req.body.phoneNumber, req.body.countryIso2])
);

router.post(
  '/auth/phone/code',
  c(phoneAuth.postVerifyCode, req => [req.cookies, req.body.code])
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

  logger.error('~~~ Unexpected error exception start ~~~');
  logger.error(err);
  logger.error('~~~ Unexpected error exception end ~~~');

  return res.status(500).json({
    error: 'Internal server error'
  });
});

export default router;
