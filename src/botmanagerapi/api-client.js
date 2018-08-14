import config from '../config'
import Axios from 'axios';

export const botManagerApiClient = (() => {
  const client = Axios.create();
  client.defaults.headers.common['x-api-key'] = config.botManagerAPI.key;
  return client;
})();
