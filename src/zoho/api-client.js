import config from '../config';
import Axios from 'axios';

export const zohoApiClient = (() => {
  const client = Axios.create();
  client.defaults.headers.common['X-com-zoho-subscriptions-organizationid'] =
    config.zoho.orgId;
  client.defaults.headers.common['Authorization'] = `Zoho-authtoken ${
    config.zoho.authToken
  }`;
  return client;
})();
