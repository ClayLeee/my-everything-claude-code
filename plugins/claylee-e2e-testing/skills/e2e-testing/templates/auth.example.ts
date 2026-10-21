import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env.test.local') })

export const accounts = {
  admin: {
    username: process.env.TEST_ADMIN_USERNAME!,
    password: process.env.TEST_ADMIN_PASSWORD!,
  },
  user: {
    username: process.env.TEST_USER_USERNAME!,
    password: process.env.TEST_USER_PASSWORD!,
  },
} as const

export type AccountRole = keyof typeof accounts
