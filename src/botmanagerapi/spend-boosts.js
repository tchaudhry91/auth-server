import { botManagerApiClient } from './api-client';
import config from '../config';
import { logger } from '../utils/logger';

export async function spendBoosts(userId, nToSpend, purchaseInsufficient) {
  if (!userId || !nToSpend) {
    return Promise.reject(
      'create boosts requires user id and n to spend'
    );
  }
  // make sure that it's a boolean
  purchaseInsufficient = !!purchaseInsufficient
  logger.debug(
    JSON.stringify({
      userId: userId,
      spendN: nToSpend,
      purchaseInsufficient: purchaseInsufficient
    })
  );
  try {
    const { data } = await botManagerApiClient.post(
      config.botManagerAPI.url + '/v1/boosts/spend',
      {
        userId: userId,
        spendN: nToSpend,
        purchaseInsufficient: purchaseInsufficient
      }
    );
    if (!data || !data.success) {
      return Promise.reject('failed to spend boosts for user');
    }
    return data.success;
  } catch (err) {
    return Promise.reject(err);
  }
}
