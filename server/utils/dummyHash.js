import bcrypt from "bcryptjs";
import { env } from "../config/env.js";

const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", env.BCRYPT_ROUNDS);

// Spend the same CPU as a real password check when the account doesn't exist,
// so response time does not reveal which IDs/emails are registered.
export const burnPasswordCheck = async (password) => {
  await bcrypt.compare(password, DUMMY_HASH);
  return false;
};
