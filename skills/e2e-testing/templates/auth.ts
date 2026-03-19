import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env.test.local') })

export const accounts = {
  sysadmin: {
    username: process.env.TEST_AD_USERNAME!,
    password: process.env.TEST_AD_PASSWORD!,
  },
  orgOwner: {
    username: process.env.TEST_OO_USERNAME!,
    password: process.env.TEST_OO_PASSWORD!,
  },
  projectManager: {
    username: process.env.TEST_PM_USERNAME!,
    password: process.env.TEST_PM_PASSWORD!,
  },
  engineer: {
    username: process.env.TEST_RD_USERNAME!,
    password: process.env.TEST_RD_PASSWORD!,
  },
  qa: {
    username: process.env.TEST_QA_USERNAME!,
    password: process.env.TEST_QA_PASSWORD!,
  },
} as const

export type AccountRole = keyof typeof accounts
