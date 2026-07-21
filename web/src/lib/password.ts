import { createHash, randomBytes } from 'crypto';

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(salt + password).digest('hex');
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, hash: string) {
  const computed = createHash('sha256').update(salt + password).digest('hex');
  return computed === hash;
}
