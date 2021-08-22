import { getInput } from "@actions/core"

export interface Inputs {
  readonly token: string
  readonly issueNumber: number
}

export const getInputs = (): Inputs => {
  return {
    token: getInput("token", { required: true }),
    issueNumber: Number(getInput("issue-number", { required: true })),
  }
}
