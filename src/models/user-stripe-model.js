import mongoose from 'mongoose';

export default new mongoose.Schema(
  {
    _id: false,
    customer_id: {
      type: String,
      index: true
    },
    card_saved: {
      type: Boolean
    },
    preferred_ccy: {
      type: String
    },
    connect_account_id: {
      type: String
    }
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  }
);
