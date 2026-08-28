import type { MyResumeApi } from './index'

declare global {
  interface Window {
    myresume: MyResumeApi
  }
}

export {}
