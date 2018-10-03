import User from '../models/user-model';
import StripeOAuthState from '../models/stripe-oauth-state';
import { BadRequestError, ForbiddenError, InternalServerError } from "../helpers/server";
import { logger } from '../utils/logger';
import { decodeToken } from '../helpers/jwt';
import config from '../config';
import axios from 'axios';

export async function stripeOAuthRedirect(cookies, redirectUrl) {
  logger.debug(`in stripeOAuthRedirect`);
  if (!redirectUrl || redirectUrl === '') {
    redirectUrl = config.client.url;
  }
  let response = {};
  let user;
  try {
    user = await User.findById(
      decodeToken(cookies[config.jwt.cookieName]).user_id
    )
      .select({ _id: 1, primary_email: 1 })
      .exec();
    if (!(user && user.primary_email)) {
      return Promise.reject(
        ForbiddenError(
          'User requires an email address in order to make a purchase'
        )
      );
    }
  } catch (error) {
    return Promise.reject(ForbiddenError());
  }
  let state = new StripeOAuthState({user_id: user._id, completed: false, redirect_url: redirectUrl});
  try {
    await state.save();
  } catch (err) {
    Promise.reject(InternalServerError());
  }
  response.redirect = `https://dashboard.stripe.com/oauth/authorize?response_type=code&client_id=${
    config.stripeConnect.clientId
  }&scope=read_write&state=${encodeURIComponent(state._id)}&redirect_uri=${encodeURIComponent(config.stripeConnect.redirectUri)}`;
  return response;
}

export async function stripeOAuthCallback(cookies, code, stateStr) {
  logger.debug(`in stripeOAuthCallback`);
  if (!stateStr || !stateStr.length || stateStr === '' || !code || !code.length || code === '') {
    return Promise.reject(BadRequestError());
  }

  let response = {};
  let user;
  let state;
  try {
    user = await User.findById(
      decodeToken(cookies[config.jwt.cookieName]).user_id
    )
      .select({ _id: 1, primary_email: 1 })
      .exec();
    state = await StripeOAuthState.findById(stateStr).exec();
    // TODO verify a reasonable TTL for the state
    if (!state || state.user_id !== user._id) {
      throw 'forbidden';
    }
  } catch (error) {
    return Promise.reject(ForbiddenError());
  }
  let acctId;
  try {
    let stripeResp = await axios.post('https://connect.stripe.com/oauth/token', {
      client_secret: config.stripeConnect.clientSecret,
      grant_type: 'authorization_code',
      code: code
    });
    acctId = stripeResp.data.stripe_user_id;
  } catch (err) {
    return Promise.reject(ForbiddenError());
  }
  try {
    state.completed = true;
    await state.save();
    if (!user.stripe) {
      user.stripe = {};
    }
    user.stripe.connect_account_id = acctId;
    await user.save();
  } catch (err) {
    return Promise.reject(InternalServerError());
  }
  response.redirect = state.redirect_url;
  return response;
}
