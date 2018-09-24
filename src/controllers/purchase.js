import { logger } from '../utils/logger';
import config from '../config';
import { decodeToken } from '../helpers/jwt';
import { ForbiddenError, BadRequestError } from '../helpers/server';
import User from '../models/user-model';
import Course from '../models/course-model';
import { spendBoosts } from '../botmanagerapi/spend-boosts';
import {
  fetchByUserAndItem,
  insertOrderRecord
} from '../db-handlers/user-orders-handler';
import { fetchDeliveryStructurePricingById } from '../db-handlers/course-delivery-price-fetch';

const ITEM_CATEGORY_COURSE_CERTIFICATE = 'course_cert', ITEM_CATEGORY_COURSE_RUN = 'course_run';

/*
payer_user_id   - deduct from this User. Default: decoded user_id is used
user_id         - User who will use the purchase. Default: decoded user_id is used
item            - Fields related to the purchase item
  category      - "course_run" OR "course_cert"
  options?      - {option:value} key/value list of 'options' or 'configurations' for the product
  quantity?     - number, fixed at 1
  refs          - {field:value} set of IDs to locate the required records
    course_id?: course._id
    cd_sched_id?: courseDeliverySchedule._id
    cd_run_id?: courseDeliverySchedule.scheduled_runs._id
    price_rec_id?: _id - link to a specific price "override" for the purchase after discounts, promos, etc. Optional-future. Offered_at_price is used
 */

async function purchaseHandler(cookies, payer_user_id, user_id, item) {
  logger.debug(`in purchaseHandler`);
  logger.debug(` purchaseObj ` + JSON.stringify(purchaseObj));

  let response = {};
  let user;
  try {
    user = await User.findById(
      decodeToken(cookies[config.jwt.cookieName]).user_id
    ).exec();
  } catch (error) {
    return Promise.reject(ForbiddenError());
  }

  if (!(item && item.category)) {
    return Promise.reject(BadRequestError('Purchase Info Missing'));
  }
  
  if (!user.primary_email) {
    return Promise.reject(ForbiddenError('User requires an email address in order to make a purchase'));
  }

  // TODO in the future, potentially allow overrides here
  payer_user_id = user._id
  user_id = user._id

  if (!item.options) {
    item.options = {}
  }

  switch (item.category) {
    case ITEM_CATEGORY_COURSE_CERTIFICATE:
      try {
        response = await buyCourseRun(payer_user_id, user_id, item);
      } catch (error) {
        logger.error(`error in buyCourseRun ` + error);
        return Promise.reject(BadRequestError(error.message));
      }
      break;
    case ITEM_CATEGORY_COURSE_RUN:
      try {
        response = await buyCourseCertificate(payer_user_id, user_id, item);
      } catch (error) {
        logger.error(`error in buyCourseCertificate ` + error);
        return Promise.reject(BadRequestError(error.message));
      }
      break;
    default:
      return Promise.reject(BadRequestError('Invalid item category'));
  }
  return response;
}

async function buyCourseCertificate(payer_user_id, user_id, item) {
  let response = {};
  logger.debug(`in buyCourseCertificate`);
  const courseId = item.refs.course_id, certType = item.options.certificate_type
  if (!courseId || (certType !== 'verified' /* TODO add other/future cert types here */)) {
    throw new Error('Purchase Info Details Missing');
  }
  let course;
  try {
    course = Course.findById(courseId).exec();
  } catch (err) {
    throw new Error('Failed to fetch course');
  }
  if (!course || !course.verified_cert_cost) {
    throw new Error('Invalid course or no support for verified certificates');
  }
  const amount = item.quantity * course.verified_cert_cost;
  const itemObjArray = [
    {
      item_category: ITEM_CATEGORY_COURSE_CERTIFICATE,
      amount: amount,
      quantity: item.quantity,
      options: {
        certificate_type: certType
      },
      item_ref: {
        course_id: course_id
      }
    }
  ];
  try {
    await spendBoosts(
      payer_user_id,
      amount,
      true
    );
  } catch (error) {
    throw new Error('Failed to checkout. Please check that you have a valid credit card on file or sufficient credits available.');
  }
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
  // TODO send emails to user and system
  try {
    await config.smtp.sendMail({
      from: config.notifications.email.from,
      to: user.primary_email,
      subject: `${config.platform.name} Order Confirmation`,
      html: `<html>
        <head>
        </head>
        <body>
          <h3>Thank you for recent purchase of a ${certType => certType === 'verified' ? 'Verified ' : ''}Certificate with ${config.platform.name}!</h3>
          <p>A representative will be in touch within 24 hours to help you:</p>
          <ol>
            <li>Verify your identity (you'll only need to do this once a year for your account)</li>
            <li>Schedule your online exam (you'll have up to two chances to take this exam on a single certificate purchase)</li>
            <li>After you pass your online exam, schedule your remote technical live exam with an ${config.platform.name} instructor</li>
          </ol>
          <p>After you complete this process, you will then recieve your certificate electronically along with a link for your potential employers to validate it - with your permission.</p>
          <h6>Order Total: ${amount} ${config.platform.name} Credits (Approx. US$${amount})</h6>
          <p>NOTE: If you had a previous credit balance with ${config.platform.name}, your credits will be deducted to cover this purchase. In the event that your account didn't have sufficient credits, the remaining required credits were added to your usage for this month and will be billed at the end of your current billing period.</p>
          <p>Please see our help center and/or message support <a href="${config.platform.helpCenterUrl}">here</a> if you have any questions/concerns.</p>
        </body>
      </html>`
    });
  } catch (error) {
    throw new Error(
      'Failed sending email to user. Please contact Support'
    );
  }
  try {
    await config.smtp.sendMail({
      from: config.notifications.email.from,
      to: config.platform.supportEmail,
      subject: `${config.platform.name} Certificate Order Notification`,
      html: `<html>
      <head>
      </head>
      <body>
        <h3>Thank you for recent purchase of a ${certType => certType === 'verified' ? 'Verified ' : ''}Certificate with ${config.platform.name}!</h3>
        <p>Order Items: </p>
        <code>
          ${JSON.stringify(itemObjArray)}
        </code>
        <p>Paid for By: </p>
        <code>
          ${JSON.stringify(user)}
        </code>
        <p>Bought for: </p>
        <code>
          ${JSON.stringify(user)}
        </code>
        <p>Order Total: </p>
        <code>
          Credits: ${amount}
        </code>
      </body>
    </html>`
    });
  } catch (error) {
    throw new Error(
      'Failed sending email to system. Please contact Support'
    );
  }
  return response;
}


// TODO NOT YET REFACTORED
async function buyCourseRun(purchaseObj) {
  let response = {};
  logger.debug(`in buyCourseRun`);
  if (!purchaseObj.ref_ids || purchaseObj.ref_ids.length < 2) {
    throw new Error('Purchase Info Details Missing');
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
    throw new Error('Purchase Info Details Missing');
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
