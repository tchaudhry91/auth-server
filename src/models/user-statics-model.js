import { logger } from '../utils/logger';
import config from '../config';

const anonymousSuffixes = [
  'Panda',
  'Zebra',
  'Puppy',
  'Cat',
  'Kitten',
  'Monarch',
  'Dog',
  'Pike',
  'Yak',
  'Woodchuck',
  'Squirrel',
  'Rabbit',
  'Bee',
  'Turtle',
  'Ant',
  'Tahr',
  'Starfish',
  'Tadpole',
  'Spider',
  'Monkey',
  'Beetle',
  'Fox',
  'Unicorn',
  'Possum',
  'Porcupine',
  'Peacock',
  'Papillon',
  'Parrot',
  'Penguin',
  'Dolphin',
  'Camel',
  'Aardvark',
  'Albatross',
  'Alpaca'
];

function pickRandomAnonymousSuffix() {
  return anonymousSuffixes[
    Math.floor(Math.random() * anonymousSuffixes.length)
  ];
}

export async function createDumpUser() {
  let user = new this();
  user.avatar_url = config.demoUser.avatarUrl;
  user.subscription = [
    {
      level: 1
    }
  ];
  user.auth_strategies = [];
  user.is_verified = false;
  user.full_name = {
    intlString: [
      {
        locale: user.primary_locale,
        content: `Anonymous ${pickRandomAnonymousSuffix()}`,
        is_default: true
      }
    ]
  };
  user.is_demo = true;
  try {
    await user.save();
  } catch (error) {
    return Promise.reject('an error occurred saving the user');
  }
  return Promise.resolve(user);
}

// method (reqd): auth strategy 'method' name
// profile (reqd): the profile data from the auth strategy
// userId (optional): supplied if we want to add this auth strategy to a user that's already logged in, i.e., elevating an anonymous user
export async function authenticate(method, profile, userId) {
  logger.debug(`in authenticate`);
  let user = await this.findOne({
    auth_strategies: {
      $elemMatch: {
        method,
        auth_id: profile.id
      }
    }
  }).exec();

  if (user) {
    return Promise.resolve(user);
  }

  if (userId) {
    user = await this.findOne({
      _id: userId
    }).exec();
  } else {
    user = await this.findOne({
      primary_email: profile.email
    }).exec();
  }
  if (!user) {
    user = new this();
    if (!profile.locale) {
      profile.locale = user.primary_locale; // default locale
    }
    user.full_name = {
      intlString: [
        {
          locale: profile.locale,
          content: profile.full_name,
          is_default: true
        }
      ]
    };
    // Note: we ignore usernames in this process since users are coming from accounts.exlinc.com where the username is just the email
    user.is_demo = false;
    user.is_verified = true;
    user.primary_email = profile.email;
    user.primary_locale = profile.locale;
    user.subscription = [
      {
        level: 1
      }
    ];
    user.avatar_url = profile.avatar;
    user.auth_strategies = [];
  } else {
    user.is_demo = false;
    user.is_verified = true;
    user.primary_locale = profile.locale;
    if (profile.avatar) {
      user.avatar_url = profile.avatar;
    }
    if (!user.primary_email) {
      user.primary_email = profile.email;
    }
    if (
      !user.full_name ||
      user.full_name.intlString[0].content.indexOf('Anonymous') !== -1
    ) {
      user.full_name = {
        intlString: [
          {
            locale: profile.locale,
            content: profile.full_name,
            is_default: true
          }
        ]
      };
    }
  }

  user.auth_strategies.push({
    auth_id: profile.id,
    email: profile.email,
    method,
    version: 1,
    payload: profile.payload
  });

  try {
    await user.save();
  } catch (error) {
    return Promise.reject('an error occurred saving the user');
  }

  return Promise.resolve(user);
}
