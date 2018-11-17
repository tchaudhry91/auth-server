import { logger } from '../utils/logger';
import { basicFind } from './basic-query-handler';
import CourseDelivery from '../models/course-delivery-model';

// TODO: replace with an aggregation pipleline query to return just the objects needed
export const fetchDeliveryStructurePricingById = async sched_run_id => {
  let record;
  try {
    record = await basicFind(
      CourseDelivery,
      { isOne: true },
      { 'delivery_structures._id': sched_run_id },
      null,
      {
        'delivery_structures._id': 1,
        'delivery_structures.list_price': 1,
        'delivery_structures.scheduled_runs': 1,
        course_id: 1
      }
    );
  } catch (errInternalAlreadyReported) {
    return null;
  }
  return record;
};
