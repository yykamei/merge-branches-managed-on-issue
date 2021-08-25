import * as core from "@actions/core"
import { context } from "@actions/github"
import type { WorkflowDispatchEvent } from "@octokit/webhooks-types"
import { getInputs } from "./inputs"
import type { Inputs } from "./inputs"
import { fetchData } from "./github"
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

const handleWorkflowDispatch = async ({
  token,
  issueNumber,
  workingDirectory,
  shell,
  beforeMerge,
  afterMerge,
  inputsParamBaseBranch,
  inputsParamForce,
}: Inputs) => {
  const payload = context.payload as WorkflowDispatchEvent
  core.debug(`We got the workflow_dispatch event with this payload: ${payload}.`)

  if (payload.inputs == null || !(inputsParamBaseBranch in payload.inputs) || !(inputsParamForce in payload.inputs)) {
    throw new Error(
      `"${inputsParamBaseBranch}" and "${inputsParamForce}" must be configured as inputs of the workflow_dispatch event in your GitHub workflow`
    )
  }
  const baseBranch = payload.inputs[inputsParamBaseBranch] as string
  const force = (payload.inputs[inputsParamForce] as string).toLowerCase() === "true"

  const { issue, defaultBranch } = await fetchData({ token, issueNumber })
  const result = parse(issue.body)
  const targetBranches = result[baseBranch]

  if (targetBranches == null) {
    throw new Error(`The specified base-branch "${baseBranch}" is not defined in the body of the issue #${issueNumber}`)
  }

  await merge({
    workingDirectory,
    shell,
    beforeMerge,
    afterMerge,
    baseBranch,
    targetBranches: targetBranches.map((t) => t.name),
    defaultBranch,
    force,
  })
}
