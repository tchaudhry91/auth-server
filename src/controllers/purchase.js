import { logger } from '../utils/logger';
import config from '../config';
import { decodeToken } from '../helpers/jwt';
import { ForbiddenError } from '../helpers/server';
import { getBoosts } from '../botmanagerapi/get-boosts';

async function buyCourseSeat(cookies, purchaseObj) {
  logger.debug(`in buyCourseSeat`);
  const tkn = cookies[config.jwt.cookieName];
  let decoded;
  try {
    decoded = decodeToken(tkn);
  } catch (error) {
    return Promise.reject(ForbiddenError());
  }

  // TODO - code using data from
  // scheduled_runs {
  //       _id
  //       offered_at_price {
  //         amount
  //       }

  const boostsResult = await getBoosts(decoded.user_id);
  return {
    creditsCount: boostsResult
  };
}
