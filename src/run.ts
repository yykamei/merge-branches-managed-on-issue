import * as core from "@actions/core"
import { context } from "@actions/github"
import type { DeleteEvent, IssueCommentEvent, IssuesEvent, WorkflowDispatchEvent } from "@octokit/webhooks-types"
import type { Inputs } from "./inputs"
import { getInputs } from "./inputs"
import { fetchData, fetchPull, updateComment, updateIssue } from "./github"
import { append, parse, reformat, remove } from "./markdown-parser"
import { deleteBranch, merge } from "./git"

export const run = async (): Promise<void> => {
  const inputs = getInputs()

  core.debug(`We got the event ${context.eventName}.`)
  switch (context.eventName) {
    case "workflow_dispatch":
      return await handleWorkflowDispatch(inputs)
    case "issues":
      return await handleIssues(inputs)
    case "issue_comment":
      return await handleIssueComment(inputs)
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
  ignore,
}: Inputs) => {
  const payload = context.payload as WorkflowDispatchEvent
  core.debug(`We got the workflow_dispatch event with this payload: ${payload}.`)

  if (payload.inputs == null || !(inputsParamBaseBranch in payload.inputs) || !(inputsParamForce in payload.inputs)) {
    throw new Error(
      `"${inputsParamBaseBranch}" and "${inputsParamForce}" must be configured as inputs of the workflow_dispatch event in your GitHub workflow`,
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
    ignore,
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

const handleIssueComment = async ({ token, issueNumber, commentPrefix }: Inputs) => {
  const payload = context.payload as IssueCommentEvent
  if (payload.issue.pull_request == null || !payload.comment.body?.startsWith(commentPrefix)) {
    return
  }

  const [_prefix, action, baseBranch] = payload.comment.body.split(/\s+/)
  if (action == null || baseBranch == null) {
    return
  }

  try {
    const { issue } = await fetchData({ token, issueNumber })
    const {
      pull: {
        author: { login: author },
        headRefName: branch,
      },
    } = await fetchPull({ token, number: payload.issue.number })

    if (action === "append-to") {
      const newBody = append({
        body: issue.body,
        branch,
        baseBranch,
        author: `@${author}`,
        pr: `#${payload.issue.number}`,
      })
      await updateIssue(issue, newBody, token)
      await updateComment(payload.comment.node_id, `✅ ${payload.comment.body}`, token)
    } else if (action === "remove-from") {
      const newBody = remove(issue.body, branch, baseBranch)
      await updateIssue(issue, newBody, token)
      await updateComment(payload.comment.node_id, `✅ ${payload.comment.body}`, token)
    }
  } catch (e) {
    await updateComment(
      payload.comment.node_id,
      `⚠️ Failed to execute "${action}". Edit this comment again.\n\n${payload.comment.body}`,
      token,
    )
    throw e
  }
}

const handleDelete = async ({ token, issueNumber, workingDirectory, shell, modifiedBranchSuffix }: Inputs) => {
  const payload = context.payload as DeleteEvent
  if (payload.ref_type !== "branch") {
    return
  }
  const branch = payload.ref.replace("refs/heads/", "")
  const { issue } = await fetchData({ token, issueNumber })
  const result = parse(issue.body).mergedBranches
  const baseBranches = Object.keys(result)
  await deleteBranch(branch, { workingDirectory, shell, modifiedBranchSuffix, baseBranches })
  const newBody = remove(issue.body, branch)
  await updateIssue(issue, newBody, token)
}
