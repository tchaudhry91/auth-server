import { logger } from '../utils/logger';
import config from '../config';
import { decodeToken } from '../helpers/jwt';
import { ForbiddenError, BadRequestError } from '../helpers/server';
import { spendBoosts } from '../botmanagerapi/spend-boosts';
import {
  fetchByUserAndItem,
  insertOrderRecord
} from '../db-handlers/user-orders-handler';
import { fetchDeliveryStructurePricingById } from '../db-handlers/course-delivery-price-fetch';

/*
purchaseObj:
payer_user_id   - deduct from this User. Default: decoded user_id is used
user_id         - User who will use the purchase. Default: decoded user_id is used
item_category   - "course_run", "cert", "course_subs"
ref_ids         - [{id_code:id_value}] set of IDs to locate the required records

   cd_sched: courseDeliverySchedule._id
   cd_run: courseDeliverySchedule.scheduled_runs._id
   price_rec: _id - link to a specific price "override" for the purchase after discounts, promos, etc. Optional-future. Offered_at_price is used
 */

async function purchaseHandler(cookies, req_body) {
  logger.debug(`in purchaseHandler`);
  logger.debug(` purchaseObj ` + JSON.stringify(req_body));

  let response = {};
  const tkn = cookies[config.jwt.cookieName];
  let decoded;
  try {
    decoded = decodeToken(tkn);
  } catch (error) {
    return Promise.reject(ForbiddenError());
  }
  logger.debug(` decoded ` + JSON.stringify(decoded));

  if (
    !(req_body && req_body.purchaseObj && req_body.purchaseObj.item_category)
  ) {
    return Promise.reject(BadRequestError('Purchase Info Missing'));
  }

  req_body.purchaseObj.payer_user_id = decoded.user_id;
  req_body.purchaseObj.user_id = decoded.user_id;

  if (req_body.purchaseObj.item_category === 'course_run') {
    try {
      response = await buyCourseRun(req_body.purchaseObj);
    } catch (error) {
      logger.error(`error in buyCourseRun ` + error);
      return Promise.reject(BadRequestError(error.message));
    }
  } else {
    return Promise.reject(BadRequestError('Invalid item_category'));
  }

  // const boostsResult = await getBoosts(decoded.user_id);
  return response;
  //{
  //  creditsCount: boostsResult
  //};
}

async function buyCourseRun(purchaseObj) {
  let response = {};
  logger.debug(`in buyCourseRun`);
  if (!purchaseObj.ref_ids || purchaseObj.ref_ids.length < 2) {
    throw new Error('Purchase Indo Details Missing');
  }

  let cd_sched_id = '';
  let cd_run_id = '';

  for (let ids of purchaseObj.ref_ids) {
    const objKeys = Object.keys(ids);
    if (objKeys) {
      if (objKeys.includes('cd_sched')) {
        cd_sched_id = ids['cd_sched'];
      } else if (objKeys.includes('cd_run')) {
        cd_run_id = ids['cd_run'];
      }
    }
  }

  if (cd_sched_id === '' && cd_run_id === '') {
    throw new Error('Purchase Indo Details Missing');
  }

  const alreadyBought = await fetchByUserAndItem(
    purchaseObj.user_id,
    purchaseObj.item_category,
    'cd_run',
    cd_run_id
  );
  if (alreadyBought) {
    response.msg =
      'The User has already purchased a seat for these sessions. No action is necessary ';
  } else {
    const courseRunData = await fetchDeliveryStructurePricingById(cd_sched_id);
    logger.debug(` runPricing ` + JSON.stringify(courseRunData));
    // TODO: update the query above and the parse below to Aggreagate Pipeline
    // Currently, the query returns the entire delivery_structures array for the Course Delivery record containing the one with the ID

    if (!courseRunData) {
      throw new Error('Invalid Course Schedule Id');
    }
    const deliveryStruct = courseRunData.delivery_structures.filter(
      obj => obj._id === cd_sched_id
    );
    //logger.debug(` deliveryStruct ` + JSON.stringify(deliveryStruct));

    let amount = deliveryStruct[0].list_price.amount;

    const scheduledRun = deliveryStruct[0].scheduled_runs.filter(
      obj => obj._id === cd_run_id
    );
    //logger.debug(` scheduledRun ` + JSON.stringify(scheduledRun));
    if (scheduledRun[0].offered_at_price) {
      amount = scheduledRun[0].offered_at_price.amount;
    }

    logger.debug(` amount ` + amount);

    if (amount > 0) {
      // TODO - uncomment
      /*
      try {
        const spend = await spendBoosts(
          purchaseObj.payer_user_id,
          amount,
          true
        );
      } catch (error) {
        throw new Error('Failed at checkout ' + error.message);
      }
*/
      const itemObjArray = [
        {
          item_category: purchaseObj.item_category,
          amount: amount,
          item_id: [
            {
              level: 'cd_run',
              doc_id: cd_run_id
            }
          ]
        }
      ];
      try {
        const orderId = await insertOrderRecord(
          purchaseObj.user_id,
          purchaseObj.payer_user_id,
          itemObjArray
        );
        response.order_id = orderId;
      } catch (error) {
        throw new Error(
          'Failed recording completed purchase. Please contact Support'
        );
      }
    } else {
      throw new Error('Price for the Course is missing');
    }
  }
  return response;
}

module.exports = {
  purchaseHandler
};
