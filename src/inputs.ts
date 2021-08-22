import { getInput } from "@actions/core"

export class Inputs {
  public readonly token: string
  public readonly issueNumber: number

  constructor() {
    this.token = getInput("token", { required: true })
    this.issueNumber = Number(getInput("issue-number", { required: true }))
  }
}
