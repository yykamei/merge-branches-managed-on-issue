import * as core from "@actions/core"
import { context } from "@actions/github"
import type { DeleteEvent, IssuesEvent, WorkflowDispatchEvent } from "@octokit/webhooks-types"
import { getInputs } from "./inputs"
import type { Inputs } from "./inputs"
import { fetchData, updateIssue } from "./github"
import { parse, reformat, remove } from "./markdown-parser"
import { deleteBranch, merge } from "./git"

export const run = async (): Promise<void> => {
  const inputs = getInputs()

  core.debug(`We got the event ${context.eventName}.`)
  switch (context.eventName) {
    case "workflow_dispatch":
      return await handleWorkflowDispatch(inputs)
    case "issues":
      return await handleIssues(inputs)
    case "delete":
      return await handleDelete(inputs)
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
  modifiedBranchSuffix,
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
  const result = parse(issue.body).mergedBranches
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
    modifiedBranchSuffix,
    defaultBranch,
    force,
  })
}

const handleIssues = async ({ issueNumber, token }: Inputs) => {
  const payload = context.payload as IssuesEvent
  if (payload.issue.number !== issueNumber) {
    return
  }
  const { issue } = await fetchData({ token, issueNumber })
  const newBody = reformat(issue.body)
  await updateIssue(issue, newBody, token)
}

const handleDelete = async ({ token, issueNumber, workingDirectory, shell, modifiedBranchSuffix }: Inputs) => {
  const payload = context.payload as DeleteEvent
  if (payload.ref_type !== "branch") {
    return
  }
  const branch = payload.ref.replace("refs/heads/", "")
  const { issue } = await fetchData({ token, issueNumber })
  await deleteBranch(branch, { workingDirectory, shell, modifiedBranchSuffix })
  const newBody = remove(issue.body, branch)
  await updateIssue(issue, newBody, token)
}
