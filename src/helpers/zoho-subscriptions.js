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

export const isValidPlanCode = (pc) => {
  return !!planCodesMap[pc]
}

export const getApiUrlForResource = (resourcePath) => {
  if (!resourcePath) {
    return '';
  }
  return config.zoho.apiBaseUrl.replace(/\/$/, '') + '/' + resourcePath.replace(/^\/+/g, '');
}
