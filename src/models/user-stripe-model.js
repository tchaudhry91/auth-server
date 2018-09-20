import mongoose from 'mongoose';

export default new mongoose.Schema(
  {
    _id: false,
    customer_id: {
      type: String,
      index: true,
    },
    credits_sub_id: {
      type: String,
      index: true
    },
    credits_sub_item_id: {
      type: String,
      index: true
    }
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  }
);
