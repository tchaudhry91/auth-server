import mongoose from 'mongoose';
import { id_gen } from '../utils/url-id-generator';

const MailingListSchema = new mongoose.Schema(
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
      required: true
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

export default mongoose.model('MailingList', MailingListSchema, 'mailing_list');
