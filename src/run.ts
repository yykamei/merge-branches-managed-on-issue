import * as core from "@actions/core"
import { context } from "@actions/github"
import { getInputs } from "./inputs"
import type { Inputs } from "./inputs"
import { fetchIssue } from "./github"
import { parse } from "./markdown-parser"
import { merge } from "./merge"

export const run = async (): Promise<void> => {
  const inputs = getInputs()

  core.debug(`We got the event ${context.eventName}.`)
  switch (context.eventName) {
    case "workflow_dispatch":
      return await handleWorkflowDispatch(inputs)
    case "issues":
      // Reformat the issue body
      return
    case "delete":
      // Delete the deleted branch from the issue body
      return
    default:
      throw new Error(`This action does not support the event "${context.eventName}"`)
  }
}

const handleWorkflowDispatch = async ({ token, issueNumber, workingDirectory, shell, beforeMerge }: Inputs) => {
  // 1. Fetch issue
  const issue = await fetchIssue({ token, issueNumber }) // TODO fetch default branch
  // 2. Parse issue body
  const result = parse(issue.body)
  console.log(JSON.stringify(result))

  // 4. Merge!
  const defaultBranch = "main"
  const baseBranch = "base"
  const targetBranches = ["b1", "b2"]
  const force = false

  await merge({ workingDirectory, shell, beforeMerge, baseBranch, targetBranches, defaultBranch, force })
}
