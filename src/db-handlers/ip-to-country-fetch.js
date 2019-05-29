import { basicFind } from './basic-query-handler';
import IpToCountry from '../models/ip-to-country-model';

export const findCountryByIntIp = async intIp => {
  let record;
  try {
    record = await basicFind(
      IpToCountry,
      { isOne: true },
      {
        ip_from: { $lte: intIp },
        ip_to: { $gte: intIp }
      },
      null,
      { co_code: 1, co_name: 1 }
    );
  } catch (errInternalAlreadyReported) {
    return null;
  }
  return record;
};
