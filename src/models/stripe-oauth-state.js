import mongoose from 'mongoose';
import { id_gen } from '../utils/url-id-generator';

const StripeOAuthStateSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: id_gen
    },
    user_id: {
      type: String,
      required: true
    },
    redirect_url: {
      type: String
    },
    completed: {
      type: Boolean
    }
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  }
);

export default mongoose.model('StripeOAuthState', StripeOAuthStateSchema, 'stripe_oauth_state');
