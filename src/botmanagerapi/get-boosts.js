import { botManagerApiClient } from './api-client';
import config from '../config';
import { logger } from '../utils/logger';

export async function getBoosts(userId) {
  if (!userId) {
    return Promise.reject('get boosts requires user id');
  }
  logger.debug(
    JSON.stringify({
      userId: userId
    })
  );
  try {
    const { data } = await botManagerApiClient.get(
      config.botManagerAPI.url + '/v1/boosts?userId=' + userId
    );
    if (!data || !data.success) {
      return Promise.reject('failed to get boosts for user');
    }
    console.log(data.data);
    return data.data ? data.data.count : 0;
  } catch (err) {
    // logger.debug(`error in getBoosts ` + err)
    return Promise.reject(err);
  }
}
