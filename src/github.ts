import * as core from "@actions/core"
import { context, getOctokit } from "@actions/github"
import type { Inputs } from "./inputs"

interface Data {
  readonly issue: Issue
  readonly defaultBranch: string
}

export const fetchData = async ({ token, issueNumber }: Pick<Inputs, "token" | "issueNumber">): Promise<Data> => {
  core.debug("Start fetchIssue()")

  const { owner, repo } = context.repo
  const octokit = getOctokit(token)
  const result: IssueResponse = await octokit.graphql(
    `
query($owner: String!, $repo: String!, $issueNumber: Int!) { 
  repository(owner: $owner, name: $repo) { 
    defaultBranchRef {
      name
    }
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
  return {
    issue: result.repository.issue,
    defaultBranch: result.repository.defaultBranchRef.name,
  }
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
    readonly defaultBranchRef: {
      readonly name: string
    }
  }
}
