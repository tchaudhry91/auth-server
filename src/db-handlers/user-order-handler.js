import { logger } from '../utils/logger';
import { basicFind } from './basic-query-handler';
import { id_gen } from '../utils/url-id-generator';
import UserOrder from '../models/user-order-model';
import {
  ITEM_CATEGORY_COURSE_CERTIFICATE,
  ITEM_CATEGORY_COURSE_RUN,
  ITEM_CATEGORY_DIGITAL_DIPLOMA_PLAN
} from '../models/order-item-model';

export const fetchByUserAndItemRefId = async (
  user_id,
  item_cat,
  item_ref_id
) => {
  logger.debug(`in fetchByUserAndItemRefId`);
  const queryVal = {
    user_id: user_id,
    'order_items.item_category': item_cat
  };
  switch (item_cat) {
    case ITEM_CATEGORY_COURSE_CERTIFICATE:
      queryVal['order_items.item_ref.course_id'] = item_ref_id;
      break;
    case ITEM_CATEGORY_COURSE_RUN:
      queryVal['order_items.item_ref.cd_run_id'] = item_ref_id;
      break;
    case ITEM_CATEGORY_DIGITAL_DIPLOMA_PLAN:
      queryVal['order_items.item_ref.dd_plan_id'] = item_ref_id;
      break;
  }
  logger.debug(`queryVal ` + JSON.stringify(queryVal));
  let record;
  try {
    record = await basicFind(UserOrder, { isOne: true }, queryVal, null, null);
  } catch (errInternalAlreadyReported) {
    return null;
  }
  return record;
};

export const insertOrderRecord = async (user_id, payer_id, itemObjArray) => {
  logger.debug(`in insertOrderRecord`);
  const order_id = id_gen();
  const userOrdersObj = {
    _id: order_id,
    user_id: user_id,
    payer_id: payer_id,
    order_items: itemObjArray
  };
  let promises = [];
  promises.push(UserOrder.create(userOrdersObj));
  await Promise.all(promises);
  logger.debug(`Order Record inserted with ID ` + order_id);
  return order_id;
};
