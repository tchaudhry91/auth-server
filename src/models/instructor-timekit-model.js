import mongoose from 'mongoose';
import TimekitIntervalSchema from './timekit-interval-model';

export default new mongoose.Schema(
  {
    _id: false,
    intervals: {
      type: [TimekitIntervalSchema]
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);
