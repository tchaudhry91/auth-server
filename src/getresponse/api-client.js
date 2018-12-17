import config from '../config';
import Axios from 'axios';

export const getResponseApiClient = (() => {
  const client = Axios.create();
  client.defaults.headers.common['x-auth-token'] = config.getResponseAPI.authToken;
  return client;
})();
