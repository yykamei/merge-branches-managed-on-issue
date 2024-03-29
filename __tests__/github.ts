import * as core from "@actions/core"
import * as github from "@actions/github"
import { fetchData, fetchPull, updateComment, updateIssue } from "../src/github"

describe("github", () => {
  const octokit: any = { graphql: jest.fn() }

  beforeAll(() => {
    jest.spyOn(core, "debug").mockImplementation(jest.fn)
  })

  beforeEach(() => {
    jest.spyOn(github.context, "repo", "get").mockReturnValue({ owner: "foo", repo: "bar" })
    jest.spyOn(github, "getOctokit").mockImplementation(() => octokit)
  })

  describe("fetchData", () => {
    it("succeeds to fetch an issue", async () => {
      jest.spyOn(octokit, "graphql").mockResolvedValueOnce({
        repository: {
          issue: {
            id: "id!",
            body: "body",
            locked: false,
            number: 832,
            state: "OPEN",
            title: "My issue",
          },
          defaultBranchRef: {
            name: "main",
          },
        },
      })
      const result = await fetchData({ token: "secret", issueNumber: 832 })
      expect(octokit.graphql).toHaveBeenCalledWith(
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
        { owner: "foo", repo: "bar", issueNumber: 832 },
      )
      expect(result).toStrictEqual({
        issue: {
          id: "id!",
          body: "body",
          locked: false,
          number: 832,
          state: "OPEN",
          title: "My issue",
        },
        defaultBranch: "main",
      })
    })
  })

  describe("fetchPull", () => {
    it("succeeds to fetch a pull request", async () => {
      jest.spyOn(octokit, "graphql").mockResolvedValueOnce({
        repository: {
          pullRequest: {
            id: 812,
            author: {
              login: "cat",
            },
            baseRefName: "main",
            headRefName: "my-car",
          },
          defaultBranchRef: {
            name: "main",
          },
        },
      })
      const result = await fetchPull({ token: "secret", number: 64 })
      expect(octokit.graphql).toHaveBeenCalledWith(
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
        { owner: "foo", repo: "bar", number: 64 },
      )
      expect(result).toStrictEqual({
        pull: {
          id: 812,
          author: {
            login: "cat",
          },
          baseRefName: "main",
          headRefName: "my-car",
        },
        defaultBranch: "main",
      })
    })
  })

  describe("updateIssue", () => {
    it("succeeds to update an issue", async () => {
      jest.spyOn(octokit, "graphql").mockResolvedValueOnce({
        updateIssue: {
          issue: {
            id: "MDU6SXNzdWU5ODM3OTQwMDc=",
          },
        },
      })
      await updateIssue({ id: "MDU6SXNzdWU5ODM3OTQwMDc=" } as any, "special description", "secret")
      expect(octokit.graphql).toHaveBeenCalledWith(
        `
mutation($id: ID!, $body: String!) { 
  updateIssue(input: {id: $id, body: $body}) {
    issue {
      id
    }
  }
}`,
        { id: "MDU6SXNzdWU5ODM3OTQwMDc=", body: "special description" },
      )
    })
  })

  describe("updateComment", () => {
    it("succeeds to update a comment", async () => {
      jest.spyOn(octokit, "graphql").mockResolvedValueOnce({
        updateIssueComment: {
          issueComment: {
            id: "IC_kwDOFTnwI842jmio",
          },
        },
      })
      await updateComment("id!", "special description", "secret")
      expect(octokit.graphql).toHaveBeenCalledWith(
        `
mutation($id: ID!, $body: String!) { 
  updateIssueComment(input: {id: $id, body: $body}) {
    issueComment {
      id
    }
  }
}`,
        { id: "id!", body: "special description" },
      )
    })
  })
})
