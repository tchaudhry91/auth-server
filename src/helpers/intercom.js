import crypto from 'crypto';
import config from '../config';

const idVerificationSecret = config.intercom.idVerificationSecret;

export const generateIntercomHash = str => {
  return crypto
    .createHmac('sha256', idVerificationSecret)
    .update(str)
    .digest('hex');
};
