import * as core from "@actions/core"
import { getInputs } from "../src/inputs"

describe("getInputs", () => {
  let getInput: any

  beforeEach(() => {
    jest.spyOn(core, "debug").mockImplementation(jest.fn)
    Object.defineProperty(process, "env", { value: { GITHUB_WORKSPACE: "/path/to/w" } })
    getInput = jest.spyOn(core, "getInput").mockImplementation(
      (name) =>
        ({
          token: "my-secret",
          "issue-number": "89",
        }[name] as any)
    )
  })

  it("creates an instance of Inputs", () => {
    const inputs = getInputs()
    expect(inputs.token).toStrictEqual("my-secret")
    expect(inputs.issueNumber).toStrictEqual(89)
    expect(inputs.workingDirectory).toStrictEqual("/path/to/w")
    expect(getInput).toHaveBeenCalledWith("token", { required: true })
    expect(getInput).toHaveBeenCalledWith("issue-number", { required: true })
    expect(getInput).toHaveBeenCalledWith("path")
  })

  describe("when GITHUB_WORKSPACE is not set", () => {
    beforeEach(() => {
      delete process.env["GITHUB_WORKSPACE"]
    })

    it("throws an error", () => {
      expect(() => getInputs()).toThrowError("GITHUB_WORKSPACE is not defined")
    })
  })

  describe("when the specified path is not under workspace", () => {
    beforeEach(() => {
      getInput = jest.spyOn(core, "getInput").mockImplementation(
        (name) =>
          ({
            token: "my-secret",
            "issue-number": "89",
            path: "../../etc",
          }[name] as any)
      )
    })

    it("throws an error", () => {
      expect(() => getInputs()).toThrowError('The specified path "../../etc" is not under "/path/to/w"')
    })
  })
})
