import mongoose from 'mongoose';
import { id_gen } from '../helpers/url-id-generator';
import { createDumpUser, authenticate } from './user-statics-model';
import UserCourseRoleSchema from './user-course-role-model';
import UserSubscriptionSchema from './user-subscription-model';
import AuthStrategySchema from './auth-strategy-model';
import UserOrganizationRoleSchema from './user-organization-role-model';
import UserStripeSchema from './user-stripe-model';
import IntlStringSchema from './intl-string-model';
import InstructorTimekitSchema from './instructor-timekit-model';

/**
 * User Schema
 */
const UserSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: id_gen
    },
    full_name: {
      type: IntlStringSchema
    },
    headline: {
      type: IntlStringSchema
    },
    username: {
      type: String,
      index: true
    },
    phone_number: {
      type: String
      // Gets a sparse index
    },
    primary_email: {
      type: String,
      index: true
    },
    secondary_emails: {
      type: [String]
    },
    biography: {
      type: IntlStringSchema
    },
    is_demo: {
      type: Boolean,
      required: true,
      default: true
    },
    has_completed_first_tutorial: {
      type: Boolean,
      required: true,
      default: false
    },
    primary_locale: {
      type: String,
      default: 'en',
      required: true
    },
    locales: {
      type: [String]
    },
    subscription: {
      type: [UserSubscriptionSchema],
      required: true
    },
    avatar_url: {
      type: String,
      required: true
    },
    is_verified: {
      type: Boolean,
      required: true,
      default: false
    },
    auth_strategies: {
      type: [AuthStrategySchema],
      default: []
    },
    organization_roles: {
      type: [UserOrganizationRoleSchema],
      default: []
    },
    course_roles: {
      type: [UserCourseRoleSchema],
      default: []
    },
    stripe: {
      type: UserStripeSchema
    },
    instructor_timekit: {
      type: InstructorTimekitSchema
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

UserSchema.index({
  'auth_strategies.auth_id': 1
});

UserSchema.index({ phone_number: 1 }, { sparse: true });

UserSchema.statics.authenticate = authenticate;
UserSchema.statics.createDumpUser = createDumpUser;

export default mongoose.model('User', UserSchema, 'user');
