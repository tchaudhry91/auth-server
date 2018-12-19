import { getResponseApiClient } from './api-client';
import config from '../config';
import { logger } from '../utils/logger';

export async function createContact(campaignId, userId, email, name, ipAddress, ignoreDupe) {
  if (!campaignId || !userId || !email) {
    return Promise.reject(
      'create contact requires campaign id, user id, and email'
    );
  }
  let postObj = {
    email,
    campaign: {
      campaignId
    },
    dayOfCycle: 0,
    customFieldValues: [
      {
        customFieldId: config.getResponseAPI.userIdPropertyId,
        value: [userId]
      }
    ]
  };
  if (name) {
    postObj.name = name;
  }
  if (ipAddress) {
    postObj.ipAddress = ipAddress;
  }
  console.log(JSON.stringify(postObj));
  try {
    const { data } = await getResponseApiClient.post(
      config.getResponseAPI.url + '/contacts',
      postObj
    );
    return true;
  } catch (err) {
    if (ignoreDupe && err.response.data && err.response.data.httpStatus === 409) {
      return true;
    }
    console.log(err)
    return Promise.reject(err);
  }
}
