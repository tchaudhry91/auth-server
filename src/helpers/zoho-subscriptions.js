import config from '../config'

export const planCodesMap = (() => {
  let pcObj = {};
  Object.keys(config.zoho.plans).forEach((key) => {
    if (config.zoho.plans[key].annual) {
      pcObj[config.zoho.plans[key].annual.planCode] = {};
    }
    if (config.zoho.plans[key].monthly) {
      pcObj[config.zoho.plans[key].monthly.planCode] = {};
    }
  });
  return pcObj;
})();

export const planCodesToSubscriptionLvl = (() => {
  let pcArr = {};
  Object.keys(config.zoho.plans).forEach((key) => {
    if (config.zoho.plans[key].annual) {
      pcArr[config.zoho.plans[key].annual.planCode] = config.zoho.plans[key].level;
    }
    if (config.zoho.plans[key].monthly) {
      pcArr[config.zoho.plans[key].monthly.planCode] = config.zoho.plans[key].level;
    }
  });
  return pcArr;
})();

export const planCodesToParams = (() => {
  let pcArr = {};
  Object.keys(config.zoho.plans).forEach((key) => {
    if (config.zoho.plans[key].annual) {
      pcArr[config.zoho.plans[key].annual.planCode] = {
        level: config.zoho.plans[key].level,
        boostsPerCycle: config.zoho.plans[key].annual.boostsPerCycle
      }
    }
    if (config.zoho.plans[key].monthly) {
      pcArr[config.zoho.plans[key].monthly.planCode] = {
        level: config.zoho.plans[key].level,
        boostsPerCycle: config.zoho.plans[key].monthly.boostsPerCycle
      }
    }
  });
  return pcArr;
})();

export const parseZohoDate = (dateStr) => {
  const splitArr = dateStr.split("-");
  // NOTE: Pass the second parameter, 10, to parseInt so that it always converts to decimal. Leading zeros can confuse it into parsing octal/etc
  // NOTE: Need to subtract one from the second arg to new Date -- which is the month -- since they are zero indexed (!)
  return new Date(parseInt(splitArr[0], 10), parseInt(splitArr[1], 10) - 1, parseInt(splitArr[2], 10), 0, 0, 0, 0);
}

export const isValidPlanCode = (pc) => {
  return !!planCodesMap[pc]
}

export const getApiUrlForResource = (resourcePath) => {
  if (!resourcePath) {
    return '';
  }
  return config.zoho.apiBaseUrl.replace(/\/$/, '') + '/' + resourcePath.replace(/^\/+/g, '');
}
