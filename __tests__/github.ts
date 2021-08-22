import * as core from "@actions/core"
import * as github from "@actions/github"
import { fetchIssue } from "../src/github"

describe("fetchIssue", () => {
  const octokit: any = { graphql: jest.fn() }

  beforeEach(() => {
    jest.spyOn(core, "debug").mockImplementation(jest.fn)
    jest.spyOn(github.context, "repo", "get").mockReturnValue({ owner: "foo", repo: "bar" })
    jest.spyOn(github, "getOctokit").mockImplementation(() => octokit)
  })

  it("succeeds to fetch an issue", async () => {
    jest.spyOn(octokit, "graphql").mockResolvedValueOnce({
      repository: {
        issue: {
          body: "body",
          locked: false,
          number: 832,
          state: "OPEN",
          title: "My issue",
        },
      },
    })
    const result = await fetchIssue({ token: "secret", issueNumber: 832 })
    expect(octokit.graphql).toHaveBeenCalledWith(
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
      { owner: "foo", repo: "bar", issueNumber: 832 }
    )
    expect(result).toStrictEqual({
      body: "body",
      locked: false,
      number: 832,
      state: "OPEN",
      title: "My issue",
    })
  })
})
