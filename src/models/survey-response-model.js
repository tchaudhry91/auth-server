import mongoose from 'mongoose';
import { id_gen } from '../utils/url-id-generator';

const SurveyResponseSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: id_gen
    },
    user_id: {
      type: String,
      required: true
    },
    locale: {
      type: String,
      required: true
    },
    campaign: {
      type: String
    },
    form_url: {
      type: String
    },
    email: {
      type: String,
      required: false
    },
    phone_number: {
      type: String,
      required: false
    },
    full_name: {
      type: String,
      required: false
    },
    answers: {
      type: Object,
      required: true,
      default: {}
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

export default mongoose.model('SurveyResponse', SurveyResponseSchema, 'survey_response');
