import * as core from "@actions/core"
import { context, getOctokit } from "@actions/github"
import type { Inputs } from "./inputs"

export const fetchData = async ({
  token,
  issueNumber,
}: Pick<Inputs, "token" | "issueNumber">): Promise<{ issue: Issue; defaultBranch: string }> => {
  core.debug("Start fetchData()")

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
      id
      body
      locked
      number
      state
      title
    }
  }
}`,
    { owner, repo, issueNumber },
  )

  core.debug(`Finish fetchData() with this response:\n${result}`)
  return {
    issue: result.repository.issue,
    defaultBranch: result.repository.defaultBranchRef.name,
  }
}

export const fetchPull = async ({
  token,
  number,
}: Pick<Inputs, "token"> & { readonly number: number }): Promise<{ pull: Pull; defaultBranch: string }> => {
  core.debug("Start fetchPull()")

  const { owner, repo } = context.repo
  const octokit = getOctokit(token)
  const result: PullResponse = await octokit.graphql(
    `
query($owner: String!, $repo: String!, $number: Int!) { 
  repository(owner: $owner, name: $repo) { 
    defaultBranchRef {
      name
    }
    pullRequest(number: $number) {
      id
      author {
        login
      }
      baseRefName
      headRefName
    }
  }
}`,
    { owner, repo, number },
  )

  core.debug(`Finish fetchPull() with this response:\n${result}`)
  return {
    pull: result.repository.pullRequest,
    defaultBranch: result.repository.defaultBranchRef.name,
  }
}

export const updateIssue = async (issue: Issue, body: string, token: string): Promise<void> => {
  core.debug("Start updateIssue()")

  const octokit = getOctokit(token)
  await octokit.graphql(
    `
mutation($id: ID!, $body: String!) { 
  updateIssue(input: {id: $id, body: $body}) {
    issue {
      id
    }
  }
}`,
    { id: issue.id, body },
  )
}

export const updateComment = async (commentId: string, body: string, token: string): Promise<void> => {
  core.debug("Start updateComment()")

  const octokit = getOctokit(token)
  await octokit.graphql(
    `
mutation($id: ID!, $body: String!) { 
  updateIssueComment(input: {id: $id, body: $body}) {
    issueComment {
      id
    }
  }
}`,
    { id: commentId, body },
  )
}

export interface Issue {
  readonly id: string
  readonly body: string
  readonly locked: boolean
  readonly number: number
  readonly state: string
  readonly title: string
}

export interface Pull {
  readonly id: string
  readonly author: {
    readonly login: string
  }
  readonly baseRefName: string
  readonly headRefName: string
}

interface IssueResponse {
  readonly repository: {
    readonly issue: Issue
    readonly defaultBranchRef: {
      readonly name: string
    }
  }
}

interface PullResponse {
  readonly repository: {
    readonly pullRequest: Pull
    readonly defaultBranchRef: {
      readonly name: string
    }
  }
}
