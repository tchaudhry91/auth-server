import {
  botManagerApiClient
} from "./api-client";
import config from '../config'

export async function createBoosts(userId, nToAdd, ttlSeconds) {
  if (!userId || !nToAdd || !ttlSeconds) {
    return Promise.reject('create boosts requires user id, ttl seconds, and n to add');
  }
  console.log(JSON.stringify({
    "userId": userId,
    "addN": nToAdd,
    "ttlSeconds": ttlSeconds
  }));
  try {
    const {
      data
    } = await botManagerApiClient.post(config.botManagerAPI.url + "/v1/boosts", {
      "userId": userId,
      "addN": nToAdd,
      "ttlSeconds": ttlSeconds
    });
    if (!data || !data.success) {
      return Promise.reject('failed to create boosts for user');
    }
    return data.success
  } catch (err) {
    return Promise.reject(err)
  }
}
