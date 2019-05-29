import * as ipaddr from 'ipaddr.js';
import { logger } from '../utils/logger';
import { findCountryByIntIp } from '../db-handlers/ip-to-country-fetch';

export const getUserGeoLocFromIp = async (req, res) => {
  logger.debug(`In getUserGeoLocFromIp`);

  // In production, the service is always behind a proxy
  const ipString =
    (req.headers['x-forwarded-for'] || '').split(',').pop() ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null);
  logger.debug(`User Ip Raw ` + ipString);
  let ip = '';
  if (ipaddr.isValid(ipString)) {
    try {
      const addr = ipaddr.parse(ipString);
      if (ipaddr.IPv6.isValid(ipString) && addr.isIPv4MappedAddress()) {
        ip = addr.toIPv4Address().toString();
      } else {
        ip = addr.toNormalizedString();
      }
    } catch (e) {
      logger.error(`Issue converting ip ` + ipString + ` ` + e);
    }
  }
  logger.debug(`User Ip ` + ip);
  if (ip.length > 6) {
    const intIp = ip2int(ip);
    logger.debug(`User Ip Dec ` + intIp);
    if (intIp > 0) {
      const co_rec = await findCountryByIntIp(intIp);
      if (co_rec && co_rec.co_code) {
        if (co_rec.co_code === '-') {
          return res.json({
            note: 'Access from a private IP range'
          });
        }
        return res.json({
          countryCode: co_rec.co_code
        });
      }
      logger.error(`Failed to match ip to Country ` + intIp);
      return res.json({
        issue: 'failed to match client IP to Country'
      });
    }
    return res.json({
      issue: 'failed to parse client IP'
    });
  }
  return res.json({
    issue: 'failed to retrieve client IP'
  });
};

export const ip2int = ip => {
  let intIp = 0;
  if (ip && ip.length > 6) {
    try {
      intIp =
        ip.split('.').reduce(function(ipInt, octet) {
          return (ipInt << 8) + parseInt(octet, 10);
        }, 0) >>> 0;
    } catch (e) {
      logger.error(`Failed converting IP to Integer ` + ip + ` ` + e);
    }
  }
  return intIp;
};
