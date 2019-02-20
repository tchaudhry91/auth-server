import config from '../config';

const twilioCountryKeys = Object.keys(config.twilio.numbers.countries);

export function selectTwilioNumberForCountry(countryIso2) {
  // TODO select most appropriate number based on the toNumber
  for (let country in twilioCountryKeys) {
    if (country === countryIso2) {
      return config.twilio.numbers.countries[country];
    }
  }
  return config.twilio.numbers.default;
}

export function standardizePhoneNumber(phoneNumber) {
  // TODO standardize/sanitized/validate (if not a phone number/null then throw an exception)
  return phoneNumber;
}
