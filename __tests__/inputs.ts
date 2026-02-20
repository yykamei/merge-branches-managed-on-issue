import * as core from "@actions/core"
import { getInputs } from "../src/inputs"

describe("getInputs", () => {
  let getInput: any

  beforeEach(() => {
    jest.spyOn(core, "debug").mockImplementation(jest.fn)
    Object.defineProperty(process, "env", {
      value: { GITHUB_WORKSPACE: "/path/to/w" },
    })
    getInput = jest.spyOn(core, "getInput").mockImplementation(
      (name) =>
        ({
          token: "my-secret",
          "issue-number": "89",
          shell: "bash -euxo pipefail",
          "before-merge": `echo OK
ls -al
date`,
        })[name] as any,
    )
  })

  it("creates an instance of Inputs", () => {
    const inputs = getInputs()
    expect(inputs.token).toStrictEqual("my-secret")
    expect(inputs.issueNumber).toStrictEqual(89)
    expect(inputs.workingDirectory).toStrictEqual("/path/to/w")
    expect(inputs.shell).toStrictEqual(["bash", "-euxo", "pipefail"])
    expect(inputs.beforeMerge).toStrictEqual(`echo OK\nls -al\ndate`)
    expect(inputs.afterMerge).toStrictEqual(null)
    expect(inputs.inputsParamBaseBranch).toStrictEqual("base-branch")
    expect(inputs.inputsParamForce).toStrictEqual("force")
    expect(inputs.modifiedBranchSuffix).toStrictEqual(".modified")
    expect(inputs.commentPrefix).toStrictEqual("/mbmi")
  })

  it("calls getInput()", () => {
    getInputs()
    expect(getInput).toHaveBeenCalledWith("token", { required: true })
    expect(getInput).toHaveBeenCalledWith("issue-number", { required: true })
    expect(getInput).toHaveBeenCalledWith("path")
    expect(getInput).toHaveBeenCalledWith("shell")
    expect(getInput).toHaveBeenCalledWith("before-merge")
    expect(getInput).toHaveBeenCalledWith("after-merge")
    expect(getInput).toHaveBeenCalledWith("inputs-param-base-branch")
    expect(getInput).toHaveBeenCalledWith("inputs-param-force")
    expect(getInput).toHaveBeenCalledWith("modified-branch-suffix")
    expect(getInput).toHaveBeenCalledWith("comment-prefix")
  })

  describe("when before-merge is not set", () => {
    beforeEach(() => {
      getInput = jest
        .spyOn(core, "getInput")
        .mockImplementation((name) => ({ token: "my-secret", "issue-number": "89", "before-merge": "" })[name] as any)
    })

    it("creates an instance of Inputs with beforeMerge being null", () => {
      const inputs = getInputs()
      expect(inputs.token).toStrictEqual("my-secret")
      expect(inputs.issueNumber).toStrictEqual(89)
      expect(inputs.workingDirectory).toStrictEqual("/path/to/w")
      expect(inputs.shell).toStrictEqual(["bash", "-eo", "pipefail"])
      expect(inputs.beforeMerge).toBeNull()
    })
  })

  describe("when GITHUB_WORKSPACE is not set", () => {
    beforeEach(() => {
      delete process.env["GITHUB_WORKSPACE"]
    })

    it("throws an error", () => {
      expect(() => getInputs()).toThrow("GITHUB_WORKSPACE is not defined")
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
          })[name] as any,
      )
    })

    it("throws an error", () => {
      expect(() => getInputs()).toThrow('The specified path "../../etc" is not under "/path/to/w"')
    })
  })
})
