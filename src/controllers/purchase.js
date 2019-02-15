import { logger } from '../utils/logger';
import config from '../config';
import { decodeToken } from '../helpers/jwt';
import { ForbiddenError, BadRequestError } from '../helpers/server';
import User from '../models/user-model';
import Course from '../models/course-model';
import { spendBoosts } from '../botmanagerapi/spend-boosts';
import {
  fetchByUserAndItemRefId,
  insertOrderRecord
} from '../db-handlers/user-order-handler';
import { fetchDeliveryStructurePricingById } from '../db-handlers/course-delivery-price-fetch';
import { fetchDigitalDiplomaById } from '../db-handlers/digital-diploma-fetch';
import { basicFind } from '../db-handlers/basic-query-handler';
import {
  ITEM_CATEGORY_COURSE_CERTIFICATE,
  ITEM_CATEGORY_COURSE_RUN,
  ITEM_CATEGORY_DIGITAL_DIPLOMA_PLAN,
  ITEM_CATEGORY_INSTRUCTOR_BOOKING_DEPOSIT
} from '../models/order-item-model';
import { getStringByLocale } from '../helpers/intl-string';
import timekit from 'timekit-sdk';

/*
payer_user_id?  - deduct from this User. Default: decoded user_id is used
user_id?        - User who will use the purchase. Default: decoded user_id is used
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
  logger.debug(` item: ` + JSON.stringify(item));

  let response = {};
  let user;
  try {
    user = await User.findById(
      decodeToken(cookies[config.jwt.cookieName]).user_id
    )
      .select({ _id: 1, primary_email: 1 })
      .exec();
  } catch (error) {
    return Promise.reject(ForbiddenError());
  }

  if (!(item && item.category && item.refs)) {
    return Promise.reject(BadRequestError('Purchase Info Missing'));
  }

  if (!(user && user.primary_email)) {
    return Promise.reject(
      ForbiddenError(
        'User requires an email address in order to make a purchase'
      )
    );
  }

  if (!item.options) {
    item.options = {};
  }

  // TODO consider handling user and payer separately if we end up needing to do that...
  payer_user_id = user._id;
  user_id = user._id;

  // logger.debug(`item.category ` + item.category);
  switch (item.category) {
    case ITEM_CATEGORY_COURSE_RUN:
      try {
        response = await buyCourseRun(user, user, item);
      } catch (error) {
        logger.error(`error in buyCourseRun ` + error);
        return Promise.reject(BadRequestError(error.message));
      }
      break;

    case ITEM_CATEGORY_COURSE_CERTIFICATE:
      try {
        response = await buyCourseCertificate(user, user, item);
      } catch (error) {
        logger.error(`error in buyCourseCertificate ` + error);
        return Promise.reject(BadRequestError(error.message));
      }
      break;
    case ITEM_CATEGORY_INSTRUCTOR_BOOKING_DEPOSIT:
      try {
        response = await payInstructorBookingDeposit(user, user, item);
      } catch (error) {
        logger.error(`error in payInstructorBookingDeposit ` + error);
        return Promise.reject(BadRequestError(error.message));
      }
      break;
    case ITEM_CATEGORY_DIGITAL_DIPLOMA_PLAN:
      try {
        response = await purchaseDigitalDiplomaPlan(user, user, item);
      } catch (error) {
        logger.error(`error in purchaseDigitalDiplomaPlan ` + error);
        return Promise.reject(BadRequestError(error.message));
      }
      break;
    default:
      return Promise.reject(BadRequestError('Invalid item category'));
  }
  return response;
}

async function purchaseDigitalDiplomaPlan(payer, user, item) {
  let response = {};
  logger.debug(`in purchaseDigitalDiplomaPlan`);

  const dd_id = item.refs.dd_id;
  const dd_plan_id = item.refs.dd_plan_id;
  const shipping_info = item.options.shipping_info;

  if (!dd_id || !dd_plan_id) {
    throw new Error('Purchase Info Details Missing');
  }

  const alreadyBought = await fetchByUserAndItemRefId(
    user._id,
    ITEM_CATEGORY_DIGITAL_DIPLOMA_PLAN,
    dd_plan_id
  );

  // TODO consider if users should be able to purhcase more than once
  // If the user has already purchased a seat, then return
  // if (alreadyBought) {
  //   response.msg =
  //     'The User has already purchased this digital diploma plan. No action is necessary ';
  //   return response;
  // }

  const digitalDiploma = await fetchDigitalDiplomaById(dd_id);
  logger.debug(` digitalDiploma ` + JSON.stringify(digitalDiploma));

  if (!digitalDiploma) {
    throw new Error('Invalid digital diploma id or no longer available');
  }

  let ddPlan = null;
  if (digitalDiploma.plans) {
    ddPlan = digitalDiploma.plans.find(plan => plan.id === dd_plan_id);
  }

  if (!ddPlan || ddPlan.is_hidden) {
    throw new Error('Invalid plan id');
  }
  if (new Date().getTime() > ddPlan.closes_at.getTime()) {
    throw new Error('Plan has already expired');
  }
  if (new Date().getTime() < ddPlan.opens_at.getTime()) {
    throw new Error('Plan is not yet available');
  }
  if (
    ddPlan.is_shipping_required &&
    (!shipping_info ||
      !shipping_info.full_name ||
      !shipping_info.addr_1 ||
      !shipping_info.city ||
      !shipping_info.state ||
      !shipping_info.country ||
      !shipping_info.zip_code)
  ) {
    throw new Error('Missing required shipping info');
  }

  let amount = ddPlan.cost;

  logger.debug(` amount ` + amount);

  if (amount <= 0) {
    throw new Error('Invalid plan price');
  }

  try {
    await spendBoosts(payer._id, amount, true);
  } catch (error) {
    throw new Error('Failed at checkout ' + error.message);
  }

  const itemObjArray = [
    {
      item_category: ITEM_CATEGORY_DIGITAL_DIPLOMA_PLAN,
      amount: amount,
      item_ref: {
        dd_id,
        dd_plan_id,
        shipping_info
      }
    }
  ];

  try {
    response.order_id = await insertOrderRecord(
      user._id,
      payer._id,
      itemObjArray
    );
  } catch (error) {
    throw new Error(
      'Failed recording completed purchase. Please contact Support'
    );
  }

  let notif_emails = [payer.primary_email];
  if (payer.primary_email !== user.primary_email) {
    notif_emails.push(user.primary_email);
  }

  try {
    for (let ind = 0; ind < notif_emails.length; ind++) {
      await config.smtp.sendMail({
        from: config.notifications.email.from,
        to: notif_emails[ind],
        subject: `${config.platform.name} Order Confirmation`,
        html: `<html>
          <head>
          </head>
          <body>
            <h3>Thank you for recent purchase of a ${getStringByLocale(ddPlan.title).text} Program for ${
              getStringByLocale(digitalDiploma.title).text
} with ${config.platform.name}!</h3>
            <p>Your dedicated ${
              config.platform.name
} Success Manager will be in touch within 24 hours with:</p>
            <ul>
              <li>Access to all program materials/resources</li>
              <li>An introduction to your instructor for the program</li>
              <li>Shipping updates and tracking number(s) for your order (if applicable)</li>
            </ul>
            <p>If you have any questions in the meantime, please feel free to reach out to the ${
              config.platform.name
} support team via the chat icon on ${config.platform.name} or via email at <a href="mailto:support@exlskills.com">support@exlskills.com</a></p>
            <p>Thank you for your purchase and we look forward to seeing you on ${config.platform.name}!</p>
            <strong>Order Total: ${amount} ${
          config.platform.name
        } Coins (US$${amount})</strong>
            <p>NOTE: If you had a previous coin balance with ${
              config.platform.name
}, your coins will be deducted to cover this purchase. In the event that your account didn't have sufficient coins, the remaining required coins were added to your usage for this month and will be billed at the end of your current billing period.</p>
            <p>Please see our help center and/or message support <a href="${
              config.platform.helpCenterUrl
}">here</a> if you have any questions/concerns.</p>
            <p>For reference, your order ID is: ${response.order_id}</p>
          </body>
        </html>`
      });
    }
  } catch (error) {
    throw new Error('Failed sending email to user. Please contact Support');
  }

  try {
    await config.smtp.sendMail({
      from: config.notifications.email.from,
      to: config.platform.supportEmail,
      subject: `${config.platform.name} DD/GP Order Notification`,
      html: `<html>
      <head>
      </head>
      <body>
        <h3>Thank you for recent purchase of a ${getStringByLocale(ddPlan.title).text} for ${
        getStringByLocale(digitalDiploma.title).text
        } with ${config.platform.name}!</h3>
        <p>Order Items: </p>
        <code>
          ${JSON.stringify(itemObjArray)}
        </code>
        <p>Paid for By: </p>
        <code>
          ${JSON.stringify(payer)}
        </code>
        <p>Bought for: </p>
        <code>
          ${JSON.stringify(user)}
        </code>
        <p>Order Total: </p>
        <code>
          Coins: ${amount}
        </code>
        <p>For reference, your order ID is: ${response.order_id}</p>
      </body>
    </html>`
    });
  } catch (error) {
    throw new Error('Failed sending email to system. Please contact Support');
  }
  return response;
}

async function payInstructorBookingDeposit(payer, user, item) {
  let response = {};
  logger.debug(`in payInstructorBookingDeposit`);

  const bookingId = item.refs.booking_id;
  if (!bookingId) {
    throw new Error('Purchase Info Details Missing');
  }
  const amount = 5; // Deposits are currently fixed at 5 coins
  const itemObjArray = [
    {
      item_category: ITEM_CATEGORY_INSTRUCTOR_BOOKING_DEPOSIT,
      amount: amount,
      quantity: 1,
      item_ref: {
        timekit_booking_id: bookingId
      }
    }
  ];
  try {
    await spendBoosts(payer._id, amount, true);
  } catch (error) {
    throw new Error(
      'Failed to checkout. Please check that you have a valid credit card on file or sufficient coins available.'
    );
  }
  let orderId = null;
  try {
    orderId = await insertOrderRecord(user._id, payer._id, itemObjArray);
    response.order_id = orderId;
  } catch (error) {
    throw new Error(
      'Failed recording completed purchase. Please contact Support'
    );
  }

  try {
    // Mark the billing paid on timekit
    const tkResp = await timekit.updateBooking({
      id: bookingId,
      action: 'pay',
      pay: {
        payment_id: orderId
      }
    });
  } catch (error) {
    console.log('TK ERROR ', error);
    throw new Error(
      'Failed recording completed purchase. Please contact Support'
    );
  }

  let notif_emails = [payer.primary_email];
  if (payer.primary_email !== user.primary_email) {
    notif_emails.push(user.primary_email);
  }

  try {
    for (let ind = 0; ind < notif_emails.length; ind++) {
      await config.smtp.sendMail({
        from: config.notifications.email.from,
        to: notif_emails[ind],
        subject: `${config.platform.name} Order Confirmation`,
        html: `<html>
          <head>
          </head>
          <body>
            <h3>Thank you for recent deposit to confirm a session with an ${
  config.platform.name
} instructor!</h3>
            <p>You should receive a confirmation from our bookings partner, Timekit, with an optional calendar invitation shortly. Your instructor will contact you via the email provided in your booking to connect for the session.</p>
            <strong>Order Total: ${amount} ${
          config.platform.name
        } Coins (US$${amount})</strong>
            <p>NOTE: If you had a previous coin balance with ${
              config.platform.name
}, your coins will be deducted to cover this purchase. In the event that your account didn't have sufficient coins, the remaining required coins were added to your usage for this month and will be billed at the end of your current billing period.</p>
            <p>Please see our help center and/or message support <a href="${
              config.platform.helpCenterUrl
}">here</a> if you have any questions/concerns.</p>
            <p>For reference, your order ID is: ${response.order_id}</p>
          </body>
        </html>`
      });
    }
  } catch (error) {
    throw new Error('Failed sending email to user. Please contact Support');
  }
  try {
    await config.smtp.sendMail({
      from: config.notifications.email.from,
      to: config.platform.supportEmail,
      subject: `${
        config.platform.name
      } Instructor Session Deposit Notification`,
      html: `<html>
      <head>
      </head>
      <body>
        <h3>Thank you for recent deposit to confirm a session with an ${
  config.platform.name
} instructor!</h3>
        <p>Order Items: </p>
        <code>
          ${JSON.stringify(itemObjArray)}
        </code>
        <p>Paid for By: </p>
        <code>
          ${JSON.stringify(payer)}
        </code>
        <p>Bought for: </p>
        <code>
          ${JSON.stringify(user)}
        </code>
        <p>Order Total: </p>
        <code>
          Coins: ${amount}
        </code>
        <p>For reference, your order ID is: ${response.order_id}</p>
      </body>
    </html>`
    });
  } catch (error) {
    throw new Error('Failed sending email to system. Please contact Support');
  }
  return response;
}

async function buyCourseCertificate(payer, user, item) {
  let response = {};
  logger.debug(`in buyCourseCertificate`);

  const courseId = item.refs.course_id;
  const certType = item.options.certificate_type;
  if (
    !courseId ||
    certType !== 'verified' /* TODO add other/future cert types here */
  ) {
    throw new Error('Purchase Info Details Missing');
  }
  let course = null;
  try {
    course = await basicFind(
      Course,
      {
        isById: true
      },
      courseId,
      null,
      { title: 1, headline: 1, verified_cert_cost: 1 }
    );
  } catch (error) {
    // Internally reported. Will exit on course = null
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
      item_options: {
        certificate_type: certType
      },
      item_ref: {
        course_id: courseId
      }
    }
  ];
  try {
    await spendBoosts(payer._id, amount, true);
  } catch (error) {
    throw new Error(
      'Failed to checkout. Please check that you have a valid credit card on file or sufficient coins available.'
    );
  }
  try {
    const orderId = await insertOrderRecord(user._id, payer._id, itemObjArray);
    response.order_id = orderId;
  } catch (error) {
    throw new Error(
      'Failed recording completed purchase. Please contact Support'
    );
  }

  let notif_emails = [payer.primary_email];
  if (payer.primary_email != user.primary_email) {
    notif_emails.push(user.primary_email);
  }

  try {
    for (let ind = 0; ind < notif_emails.length; ind++) {
      await config.smtp.sendMail({
        from: config.notifications.email.from,
        to: notif_emails[ind],
        subject: `${config.platform.name} Order Confirmation`,
        html: `<html>
          <head>
          </head>
          <body>
            <h3>Thank you for recent purchase of a ${
  certType === 'verified' ? 'Verified ' : ''
}Certificate with ${config.platform.name} for the ${
  getStringByLocale(course.title).text
} Course!</h3>
            <p>Your ${
  config.platform.name
} Success Manager will be in touch within 24 hours to help you:</p>
            <ol>
              <li>Verify your identity (you'll only need to do this once a year for your account)</li>
              <li>Schedule your online exam (you'll have up to two chances to take this exam on a single certificate purchase)</li>
              <li>After you pass your online exam, schedule your remote technical live exam with an ${
                config.platform.name
              } instructor</li>
            </ol>
            <p>After you complete this process, you will then recieve your certificate electronically along with a link for your potential employers to validate it - with your permission.</p>
            <strong>Order Total: ${amount} ${
          config.platform.name
} Coins (US$${amount})</strong>
            <p>NOTE: If you had a previous coin balance with ${
              config.platform.name
            }, your coins will be deducted to cover this purchase. In the event that your account didn't have sufficient coins, the remaining required coins were added to your usage for this month and will be billed at the end of your current billing period.</p>
            <p>Please see our help center and/or message support <a href="${
              config.platform.helpCenterUrl
}">here</a> if you have any questions/concerns.</p>
            <p>For reference, your order ID is: ${response.order_id}</p>
          </body>
        </html>`
      });
    }
  } catch (error) {
    throw new Error('Failed sending email to user. Please contact Support');
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
        <h3>Thank you for recent purchase of a ${
  certType === 'verified' ? 'Verified ' : ''
}Certificate with ${config.platform.name} for the ${
  getStringByLocale(course.title).text
} Course!</h3>
        <p>Order Items: </p>
        <code>
          ${JSON.stringify(itemObjArray)}
        </code>
        <p>Paid for By: </p>
        <code>
          ${JSON.stringify(payer)}
        </code>
        <p>Bought for: </p>
        <code>
          ${JSON.stringify(user)}
        </code>
        <p>Order Total: </p>
        <code>
          Coins: ${amount}
        </code>
        <p>For reference, your order ID is: ${response.order_id}</p>
      </body>
    </html>`
    });
  } catch (error) {
    throw new Error('Failed sending email to system. Please contact Support');
  }
  return response;
}

async function buyCourseRun(payer, user, item) {
  let response = {};
  logger.debug(`in buyCourseRun`);

  const cd_sched_id = item.refs.cd_sched_id;
  const cd_run_id = item.refs.cd_run_id;

  if (!cd_sched_id || !cd_run_id) {
    throw new Error('Purchase Info Details Missing');
  }

  const alreadyBought = await fetchByUserAndItemRefId(
    user._id,
    ITEM_CATEGORY_COURSE_RUN,
    cd_run_id
  );

  // If the user has already purchased a seat, then return
  if (alreadyBought) {
    response.msg =
      'The User has already purchased a seat for these sessions. No action is necessary ';
    return response;
  }

  const courseRunData = await fetchDeliveryStructurePricingById(cd_sched_id);
  logger.debug(` runPricing ` + JSON.stringify(courseRunData));

  let course = null;
  try {
    course = await basicFind(
      Course,
      {
        isById: true
      },
      courseRunData.course_id,
      null,
      { title: 1, headline: 1 }
    );
  } catch (error) {
    // Internally reported. Will exit on course = null
  }

  if (!course) {
    throw new Error('Invalid course or no support for verified certificates');
  }

  // TODO: update the query above and the parse below to Aggreagate Pipeline
  // Currently, the query returns the entire delivery_structures array for the Course Delivery record containing the one with the ID

  if (!courseRunData) {
    throw new Error('Invalid Course Schedule Id');
  }
  const deliveryStruct = courseRunData.delivery_structures.filter(
    obj => obj._id === cd_sched_id
  );

  if (!(deliveryStruct && deliveryStruct.length > 0)) {
    throw new Error('Invalid Course Schedule Id');
  }

  let amount = deliveryStruct[0].list_price.amount;

  const scheduledRun = deliveryStruct[0].scheduled_runs.filter(
    obj => obj._id === cd_run_id
  );

  if (!(scheduledRun && scheduledRun.length > 0)) {
    throw new Error('Invalid Course Run Id');
  }

  if (scheduledRun[0].offered_at_price) {
    amount = scheduledRun[0].offered_at_price.amount;
  }

  logger.debug(` amount ` + amount);

  if (amount <= 0) {
    throw new Error('Invalid course run price');
  }

  try {
    await spendBoosts(payer._id, amount, true);
  } catch (error) {
    throw new Error('Failed at checkout ' + error.message);
  }

  const itemObjArray = [
    {
      item_category: ITEM_CATEGORY_COURSE_RUN,
      amount: amount,
      item_ref: {
        cd_run_id: cd_run_id
      }
    }
  ];

  try {
    const orderId = await insertOrderRecord(user._id, payer._id, itemObjArray);
    response.order_id = orderId;
  } catch (error) {
    throw new Error(
      'Failed recording completed purchase. Please contact Support'
    );
  }

  let notif_emails = [payer.primary_email];
  if (payer.primary_email != user.primary_email) {
    notif_emails.push(user.primary_email);
  }

  try {
    for (let ind = 0; ind < notif_emails.length; ind++) {
      await config.smtp.sendMail({
        from: config.notifications.email.from,
        to: notif_emails[ind],
        subject: `${config.platform.name} Order Confirmation`,
        html: `<html>
          <head>
          </head>
          <body>
            <h3>Thank you for recent purchase of a Live Course Series for ${
  getStringByLocale(course.title).text
} with ${config.platform.name}!</h3>
            <p>A ${
  config.platform.name
} Success Manager will be in touch within 24 hours with:</p>
            <ul>
              <li>Links and credentials to the live course</li>
              <li>Any extra required course materials/resources</li>
              <li>An introduction to your instructor for the course</li>
            </ul>
            <p>In the event of any course schedule changes, your ${
  config.platform.name
} Success Manager will also notify you as early as possible. If you're unable to attend a live session in the series that you signed up, you'll be able to download a recording online shortly after the session is completed.</p>
            <strong>Order Total: ${amount} ${
  config.platform.name
} Coins (US$${amount})</strong>
            <p>NOTE: If you had a previous coin balance with ${
              config.platform.name
}, your coins will be deducted to cover this purchase. In the event that your account didn't have sufficient coins, the remaining required coins were added to your usage for this month and will be billed at the end of your current billing period.</p>
            <p>Please see our help center and/or message support <a href="${
              config.platform.helpCenterUrl
}">here</a> if you have any questions/concerns.</p>
            <p>For reference, your order ID is: ${response.order_id}</p>
          </body>
        </html>`
      });
    }
  } catch (error) {
    throw new Error('Failed sending email to user. Please contact Support');
  }

  try {
    await config.smtp.sendMail({
      from: config.notifications.email.from,
      to: config.platform.supportEmail,
      subject: `${config.platform.name} Live Series Order Notification`,
      html: `<html>
      <head>
      </head>
      <body>
        <h3>Thank you for recent purchase of a Live Course Series for ${
  getStringByLocale(course.title).text
} with ${config.platform.name}!</h3>
        <p>Order Items: </p>
        <code>
          ${JSON.stringify(itemObjArray)}
        </code>
        <p>Paid for By: </p>
        <code>
          ${JSON.stringify(payer)}
        </code>
        <p>Bought for: </p>
        <code>
          ${JSON.stringify(user)}
        </code>
        <p>Order Total: </p>
        <code>
          Coins: ${amount}
        </code>
        <p>For reference, your order ID is: ${response.order_id}</p>
      </body>
    </html>`
    });
  } catch (error) {
    throw new Error('Failed sending email to system. Please contact Support');
  }
  return response;
}

module.exports = {
  purchaseHandler
};
