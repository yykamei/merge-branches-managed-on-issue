import { getInput } from "@actions/core"
import * as path from "path"

export interface Inputs {
  readonly token: string
  readonly issueNumber: number
  readonly workingDirectory: string
}

export const getInputs = (): Inputs => {
  return {
    token: getInput("token", { required: true }),
    issueNumber: Number(getInput("issue-number", { required: true })),
    workingDirectory: resolvedWorkingDirectory(),
  }
}

const resolvedWorkingDirectory = (): string => {
  const relative = getInput("path") || "." // NOTE: Handle an empty string as "."
  let githubWorkspacePath = process.env["GITHUB_WORKSPACE"]
  if (!githubWorkspacePath) {
    throw new Error("GITHUB_WORKSPACE is not defined")
  }
  githubWorkspacePath = path.resolve(githubWorkspacePath)
  const workingDirectory = path.resolve(githubWorkspacePath, relative)
  if (!(workingDirectory + path.sep).startsWith(githubWorkspacePath + path.sep)) {
    throw new Error(`The specified path "${relative}" is not under "${githubWorkspacePath}"`)
  }
  return workingDirectory
}
