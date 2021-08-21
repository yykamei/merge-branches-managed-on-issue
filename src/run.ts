import * as core from "@actions/core"
import { context } from "@actions/github"

export const run = async () => {
  core.debug(`We got the event ${context.eventName}.`)
  switch (context.eventName) {
    case "workflow_dispatch":
      return
    case "issues":
      return
    case "delete":
      return
    default:
      throw new Error(`This action does not support the event "${context.eventName}"`)
  }
}
