import config from '../config';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import {
  getStringByLocale
} from './intl-string';

let jwtPrivateKey = '';
let jwtPublicKey = '';

if (config.jwt.publicKeyBase64) {
  try {
    jwtPublicKey = (new Buffer(config.jwt.publicKeyBase64, 'base64')).toString('ascii');
  } catch (err) {
    console.error("Failed to decode base64 public key: ", err)
  }
} else {
  try {
    jwtPublicKey = fs.readFileSync(String(config.jwt.publicKeyFile), 'ascii');
  } catch (err) {
    console.error("Failed to read public key from file: ", config.jwt.publicKeyFile, " with error: ", err)
  }
}

if (config.jwt.privateKeyBase64) {
  try {
    jwtPrivateKey = (new Buffer(config.jwt.privateKeyBase64, 'base64')).toString('ascii');
  } catch (err) {
    console.error("Failed to decode base64 private key: ", err)
  }
} else {
  try {
    jwtPrivateKey = fs.readFileSync(String(config.jwt.privateKeyFile), 'ascii');
  } catch (err) {
    console.error("Failed to read private key from file: ", config.jwt.privateKeyFile, " with error: ", err)
  }
}

export const generateToken = user => {
  let full_name = getStringByLocale(user.full_name);
  if (!full_name || full_name.err) {
    full_name = 'Anonymous';
  } else {
    full_name = full_name.text;
  }

  const jwtToken = jwt.sign({
      user_id: user._id,
      locale: user.primary_locale,
      email: user.primary_email,
      avatar_url: user.avatar_url,
      full_name: full_name,
      username: user.username,
      is_demo: user.is_demo,
      has_completed_first_tutorial: user.has_completed_first_tutorial,
      is_verified: user.is_verified,
      subscription: user.subscription
    },
    jwtPrivateKey, {
      algorithm: 'RS256'
    }
  );

  return jwtToken;
};

export const decodeToken = token => {
  return jwt.verify(token, jwtPublicKey, {
    algorithm: 'RS256'
  });
};

export const getRawDataPartFromToken = token => {
  let startPos = token.indexOf('.') + 1;
  let endPos = token.indexOf('.', startPos);
  return token.substring(startPos, endPos);
};
