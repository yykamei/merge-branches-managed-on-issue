import * as core from "@actions/core"
import { context } from "@actions/github"
import { run } from "../src/run"
import * as inputs from "../src/inputs"
import * as github from "../src/github"

describe("run", () => {
  beforeAll(() => {
    jest.spyOn(core, "debug").mockImplementation(jest.fn)
    jest.spyOn(inputs, "getInputs").mockImplementation(() => ({
      token: "token",
      issueNumber: 73,
      workingDirectory: "/foo",
      shell: ["bash", "eo", "pipefail"],
      beforeMerge: null,
    }))
  })

  describe("when the event is workflow_dispatch", () => {
    beforeEach(() => {
      Object.defineProperty(context, "eventName", { value: "workflow_dispatch" })
    })

    it("succeeds", async () => {
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
      const fetchIssue = jest.spyOn(github, "fetchIssue").mockResolvedValueOnce({ body } as any)
      await run()
      expect(fetchIssue).toHaveBeenCalledWith({ token: "token", issueNumber: 73 })
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
    beforeEach(() => {
      Object.defineProperty(context, "eventName", { value: "delete" })
    })

    it("succeeds", async () => {
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
