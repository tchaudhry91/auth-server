import { logger } from '../utils/logger';
import User from '../models/user-model';
import MailingList from '../models/mailing-list-model';
import SurveyResponse from '../models/survey-response-model';
import { decodeToken } from '../helpers/jwt';
import config from '../config';
import {
  ForbiddenError,
  BadRequestError,
  InternalServerError
} from '../helpers/server';
import { validateEmail } from '../utils/email';
import { createContact } from '../getresponse/create-contact';
import { getStringByLocale } from '../helpers/intl-string';

export async function getSurveyResponse(cookies, campaign) {
  logger.debug(`in getSurveyResponse`);
  logger.debug(decodeToken(cookies[config.jwt.cookieName]).user_id);
  let user;
  try {
    user = await User.findById(
      decodeToken(cookies[config.jwt.cookieName]).user_id
    ).exec();
  } catch (error) {
    return Promise.reject(ForbiddenError());
  }
  if (!campaign) {
    return Promise.reject(BadRequestError());
  }

  let surveyResp;
  try {
    surveyResp = await SurveyResponse.findOne({
      user_id: user._id,
      locale: 'en',
      campaign: campaign
    });
    if (!surveyResp) {
      surveyResp = new SurveyResponse({
        user_id: user._id,
        locale: 'en',
        campaign: campaign
      });
      await surveyResp.save();
    }
  } catch (err) {
    return Promise.reject(InternalServerError());
  }
  return {
    surveyResponse: surveyResp
  };
}

export async function putSurveyResponseAnswer(
  cookies,
  campaign,
  answerKey,
  answerJson
) {
  logger.debug(`in putSurveyResponseAnswer`);
  logger.debug(decodeToken(cookies[config.jwt.cookieName]).user_id);
  let user;
  try {
    user = await User.findById(
      decodeToken(cookies[config.jwt.cookieName]).user_id
    ).exec();
  } catch (error) {
    return Promise.reject(ForbiddenError());
  }
  if (!campaign) {
    return Promise.reject(BadRequestError());
  }
  let answerData;
  try {
    answerData = JSON.parse(answerJson);
  } catch (e) {
    return Promise.reject(BadRequestError());
  }

  let surveyResp;
  try {
    surveyResp = await SurveyResponse.findOne({
      user_id: user._id,
      locale: 'en',
      campaign: campaign
    });
    if (!surveyResp) {
      let ansObj = {};
      ansObj[answerKey] = answerData;
      surveyResp = new SurveyResponse({
        user_id: user._id,
        locale: 'en',
        campaign: campaign,
        answers: ansObj
      });
      await surveyResp.save();
    } else {
      surveyResp.answers[answerKey] = answerData;
      surveyResp.markModified('answers');
      await surveyResp.save();
    }
  } catch (err) {
    return Promise.reject(InternalServerError());
  }
  return {
    surveyResponse: surveyResp
  };
}

export async function putSurveyResponseMeta(
  cookies,
  reqIpAddr,
  emailAddr,
  phoneNumber,
  fullName,
  campaign,
  formUrl
) {
  logger.debug(`in putSurveyResponseMeta`);
  logger.debug(decodeToken(cookies[config.jwt.cookieName]).user_id);
  let user;
  try {
    user = await User.findById(
      decodeToken(cookies[config.jwt.cookieName]).user_id
    ).exec();
  } catch (error) {
    return Promise.reject(ForbiddenError());
  }
  if (!emailAddr || !validateEmail(emailAddr)) {
    return Promise.reject(BadRequestError());
  }
  if (!campaign) {
    return Promise.reject(BadRequestError());
  }
  if (!formUrl) {
    formUrl = '_unknown';
  }

  let surveyResp;
  let emailUpdated = true;
  try {
    surveyResp = await SurveyResponse.findOne({
      user_id: user._id,
      locale: 'en',
      campaign: campaign
    });
    if (!surveyResp) {
      surveyResp = new SurveyResponse({
        user_id: user._id,
        locale: 'en',
        email: emailAddr,
        campaign: campaign,
        form_url: formUrl,
        phone_number: phoneNumber,
        full_name: fullName
      });
      await surveyResp.save();
    } else {
      if (surveyResp.email === emailAddr) {
        emailUpdated = false;
      } else {
        surveyResp.email = emailAddr;
      }
      surveyResp.phone_number = phoneNumber;
      surveyResp.full_name = fullName;
      await surveyResp.save();
    }
  } catch (err) {
    return Promise.reject(InternalServerError());
  }
  if (!emailUpdated) {
    return {
      success: true
    };
  }

  try {
    await MailingList.create({
      user_id: user._id,
      locale: 'en',
      email: emailAddr,
      campaign: campaign,
      form_url: formUrl
    });
  } catch (error) {
    return Promise.reject(InternalServerError());
  }
  if (campaign === '_unknown' || !config.getResponseAPI.campaigns[campaign]) {
    // Nothing else left for us to try
    return {
      success: true
    };
  }
  let userFullName = getStringByLocale(user.full_name).text || fullName || '';
  if (userFullName.startsWith('Anonymous')) {
    if (fullName) {
      userFullName = fullName;
    } else {
      userFullName = undefined;
    }
  }
  try {
    await createContact(
      config.getResponseAPI.campaigns[campaign],
      user._id,
      emailAddr,
      userFullName,
      reqIpAddr,
      true
    );
  } catch (error) {
    // console.log(error);
    return Promise.reject(InternalServerError());
  }
  return {
    success: true
  };
}
