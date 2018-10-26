import { basicFind } from './basic-query-handler';
import DigitalDiploma from '../models/digital-diploma-model';

export const fetchDigitalDiplomaById = async digitalDiplomaId => {
  let record;
  try {
    record = await basicFind(
      DigitalDiploma,
      { isById: true },
      digitalDiplomaId,
      null,
      null
    );
  } catch (errInternalAlreadyReported) {
    return null;
  }
  return record;
};
