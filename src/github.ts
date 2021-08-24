import * as core from "@actions/core"
import { context, getOctokit } from "@actions/github"
import type { Inputs } from "./inputs"

export const fetchIssue = async ({ token, issueNumber }: Pick<Inputs, "token" | "issueNumber">): Promise<Issue> => {
  core.debug("Start fetchIssue()")

  const { owner, repo } = context.repo
  const octokit = getOctokit(token)
  const result: IssueResponse = await octokit.graphql(
    `
query($owner: String!, $repo: String!, $issueNumber: Int!) { 
  repository(owner: $owner, name: $repo) { 
    issue(number: $issueNumber) {
      body
      locked
      number
      state
      title
    }
  }
}`,
    { owner, repo, issueNumber }
  )

  core.debug(`Finish fetchIssue() with this response:\n${result}`)
  return result.repository.issue
}

export interface Issue {
  readonly body: string
  readonly locked: boolean
  readonly number: number
  readonly state: string
  readonly title: string
}

interface IssueResponse {
  readonly repository: {
    readonly issue: Issue
  }
}
