import * as core from "@actions/core"
import { Inputs } from "../src/inputs"

describe("Inputs", () => {
  let getInput: any

  beforeEach(() => {
    jest.spyOn(core, "debug").mockImplementation(jest.fn)
    getInput = jest.spyOn(core, "getInput").mockImplementation(
      (name) =>
        ({
          token: "my-secret",
          "issue-number": "89",
        }[name] as any)
    )
  })

  it("creates an instance of Inputs", () => {
    const inputs = new Inputs()
    expect(inputs.token).toStrictEqual("my-secret")
    expect(inputs.issueNumber).toStrictEqual(89)
    expect(getInput).toHaveBeenCalledWith("token", { required: true })
    expect(getInput).toHaveBeenCalledWith("issue-number", { required: true })
  })
})
