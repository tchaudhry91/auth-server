import crypto from 'crypto'

export function generateGravatarUrlForEmail(email) {
  if (!email) {
    email = "";
  }
  return `https://www.gravatar.com/avatar/${crypto.createHash('md5').update(email).digest("hex")}?d=robohash`;
}
