import * as core from "@actions/core"
import { context } from "@actions/github"
import { run } from "../src/run"
import * as inputs from "../src/inputs"
import * as github from "../src/github"
import * as git from "../src/git"

describe("run", () => {
  beforeAll(() => {
    jest.spyOn(core, "debug").mockImplementation(jest.fn)
    jest.spyOn(inputs, "getInputs").mockImplementation(() => ({
      token: "token",
      issueNumber: 73,
      workingDirectory: "/foo",
      shell: ["bash", "-eo", "pipefail"],
      beforeMerge: null,
      afterMerge: null,
      inputsParamBaseBranch: "base-branch",
      inputsParamForce: "force",
      modifiedBranchSuffix: ".modified",
    }))
  })

  describe("when the event is workflow_dispatch", () => {
    const body = `This is a markdown body.

## staging
| branch                | author   | PR   | Note                                        |
| --------------------- | -------- | ---- | ------------------------------------------- |
| branch1               | @yykamei | #123 | This will be used until the end of October. |
| feature/add-something | @yykamei | #138 |                                             |

## strawberry
| branch                | author   | PR   | Note                                        |
| --------------------- | -------- | ---- | ------------------------------------------- |
| feature/add-something | @yykamei | #138 |                                             |
| branch2               | @yykamei | #139 |                                             |
| branch3               | @yykamei | #140 |                                             |
`
    beforeEach(() => {
      Object.defineProperty(context, "eventName", { value: "workflow_dispatch" })
      Object.defineProperty(context, "payload", { value: { inputs: { "base-branch": "staging", force: "false" } } })
    })

    it("calls fetchData and merge", async () => {
      const fetchData = jest.spyOn(github, "fetchData").mockResolvedValueOnce({
        issue: { body },
        defaultBranch: "main",
      } as any)
      const callMerge = jest.spyOn(git, "merge").mockResolvedValueOnce("git-log")

      await run()
      expect(fetchData).toHaveBeenCalledWith({ token: "token", issueNumber: 73 })
      expect(callMerge).toHaveBeenCalledWith({
        workingDirectory: "/foo",
        shell: ["bash", "-eo", "pipefail"],
        beforeMerge: null,
        afterMerge: null,
        baseBranch: "staging",
        targetBranches: ["branch1", "feature/add-something"],
        modifiedBranchSuffix: ".modified",
        defaultBranch: "main",
        force: false,
      })
    })

    it("throws an error because of the lack of force in inputs", async () => {
      Object.defineProperty(context, "payload", { value: { inputs: { "base-branch": "staging" } } })
      try {
        await run()
      } catch (e: any) {
        expect(e.message).toEqual(
          '"base-branch" and "force" must be configured as inputs of the workflow_dispatch event in your GitHub workflow'
        )
      }
    })

    it("throws an error because of the lack of base-branch in inputs", async () => {
      Object.defineProperty(context, "payload", { value: { inputs: { force: "true" } } })
      try {
        await run()
      } catch (e: any) {
        expect(e.message).toEqual(
          '"base-branch" and "force" must be configured as inputs of the workflow_dispatch event in your GitHub workflow'
        )
      }
    })

    it("throws an error because the specified base-branch does not exist in the issue", async () => {
      Object.defineProperty(context, "payload", { value: { inputs: { "base-branch": "something", force: "true" } } })
      jest.spyOn(github, "fetchData").mockResolvedValueOnce({
        issue: { body },
        defaultBranch: "main",
      } as any)
      try {
        await run()
      } catch (e: any) {
        expect(e.message).toEqual('The specified base-branch "something" is not defined in the body of the issue #73')
      }
    })
  })

  describe("when the event is issues", () => {
    beforeEach(() => {
      Object.defineProperty(context, "eventName", { value: "issues" })
    })

    it("succeeds", async () => {
      await run()
    })
  })

  describe("when the event is delete", () => {
    const body = `This is a markdown body.

## staging
| branch                | author   | PR   | Note |
| --------------------- | -------- | ---- | ---- |
| branch1               | @yykamei | #123 |      |
| feature/add-something | @yykamei | #138 |      |

## strawberry
| branch                | author   | PR   | Note |
| --------------------- | -------- | ---- | ---- |
| feature/add-something | @yykamei | #138 |      |
| branch2               | @yykamei | #139 |      |
| branch3               | @yykamei | #140 |      |
`
    beforeEach(() => {
      Object.defineProperty(context, "eventName", { value: "delete" })
      Object.defineProperty(context, "payload", {
        value: { ref_type: "branch", ref: "refs/heads/feature/add-something" },
      })
    })

    it("succeeds", async () => {
      const fetchData = jest.spyOn(github, "fetchData").mockResolvedValueOnce({ issue: { id: "id!", body } } as any)
      const deleteBranch = jest.spyOn(git, "deleteBranch").mockResolvedValueOnce(undefined)
      const updateIssue = jest.spyOn(github, "updateIssue").mockResolvedValueOnce(undefined)
      await run()
      expect(fetchData).toHaveBeenCalledWith({ token: "token", issueNumber: 73 })
      expect(deleteBranch).toHaveBeenCalledWith("feature/add-something", {
        workingDirectory: "/foo",
        shell: ["bash", "-eo", "pipefail"],
        modifiedBranchSuffix: ".modified",
      })
      const newBody = `This is a markdown body.

## staging

| branch  | author   | PR   | Note |
| ------- | -------- | ---- | ---- |
| branch1 | @yykamei | #123 |      |

## strawberry

| branch  | author   | PR   | Note |
| ------- | -------- | ---- | ---- |
| branch2 | @yykamei | #139 |      |
| branch3 | @yykamei | #140 |      |
`
      expect(updateIssue).toHaveBeenCalledWith({ id: "id!", body }, newBody, "token")
    })

    it("does nothing because the ref_type is tag", async () => {
      Object.defineProperty(context, "payload", {
        value: { ref_type: "tag", ref: "refs/heads/v1.1.1" },
      })
      await run()
    })
  })

  describe("when the event is not supported", () => {
    it.each([["push", "pull_request", "status"]])("throws an error", async (value) => {
      Object.defineProperty(context, "eventName", { value })
      try {
        await run()
      } catch (e: any) {
        expect(e.message).toEqual(`This action does not support the event "${value}"`)
      }
    })
  })
})
