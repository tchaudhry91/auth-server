import mongoose from 'mongoose';

const IpToCountrySchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    default: new mongoose.Types.ObjectId(),
    auto: true
  },
  ip_from: {
    type: Number
  },
  ip_to: {
    type: Number
  },
  co_code: {
    type: String
  },
  co_name: {
    type: String
  }
});

IpToCountrySchema.index(
  {
    ip_from: 1,
    ip_to: 1
  },
  {
    unique: true
  }
);

export default mongoose.model(
  'IpToCountry',
  IpToCountrySchema,
  'ip_to_country'
);
