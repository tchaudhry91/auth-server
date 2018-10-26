import { logger } from '../utils/logger';
import { basicFind } from './basic-query-handler';
import DigitalDiploma from '../models/course-delivery-model';

export const fetchDigitalDiplomaById = async digitalDiplomaId => {
  let record;
  try {
    record = await basicFind(
      DigitalDiploma,
      { isById: true },
      digitalDiplomaId,
      null,
      {}
    );
  } catch (errInternalAlreadyReported) {
    return null;
  }
  return record;
};
