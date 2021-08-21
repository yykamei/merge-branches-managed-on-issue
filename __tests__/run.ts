import * as core from "@actions/core"
import { context } from "@actions/github"
import { run } from "../src/run"

describe("run", () => {
  beforeAll(() => {
    jest.spyOn(core, "debug").mockImplementation(jest.fn)
  })

  describe("when the event is workflow_dispatch", () => {
    beforeEach(() => {
      Object.defineProperty(context, "eventName", { value: "workflow_dispatch" })
    })

    it("succeeds", async () => {
      await run()
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
