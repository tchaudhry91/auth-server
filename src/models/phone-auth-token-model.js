import mongoose from 'mongoose';

const PhoneAuthTokenSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true
    },
    code: {
      type: String,
      required: true
    },
    phone_number: {
      type: String,
      required: true
    },
    verified: {
      type: Boolean,
      default: false,
      required: true
    },
    expires_at: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  }
);

export default mongoose.model('PhoneAuthToken', PhoneAuthTokenSchema, 'phone_auth_token');
