import { getInput } from "@actions/core"
import * as path from "path"

export interface Inputs {
  readonly token: string
  readonly issueNumber: number
  readonly workingDirectory: string
  readonly shell: string[]
  readonly beforeMerge: string | null
  readonly afterMerge: string | null
  readonly inputsParamBaseBranch: string
  readonly inputsParamForce: string
  readonly modifiedBranchSuffix: string
}

export const getInputs = (): Inputs => {
  return {
    token: getInput("token", { required: true }),
    issueNumber: Number(getInput("issue-number", { required: true })),
    workingDirectory: resolvedWorkingDirectory(),
    shell: getShell(),
    beforeMerge: getInput("before-merge") || null, // NOTE: Make the value `null` if it seems falsy.
    afterMerge: getInput("after-merge") || null, // NOTE: Make the value `null` if it seems falsy.
    inputsParamBaseBranch: getInput("inputs-param-base-branch") || "base-branch", // NOTE: Make the value `null` if it seems falsy.
    inputsParamForce: getInput("inputs-param-force") || "force", // NOTE: Make the value `null` if it seems falsy.
    modifiedBranchSuffix: getInput("modified-branch-suffix") || ".modified", // NOTE: Make the value `null` if it seems falsy.
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

const getShell = (): string[] => {
  // TODO: Consider platform differences between Linux and Windows.
  const shell = getInput("shell") || "bash -eo pipefail" // NOTE: Handle an empty string as "."
  return shell.split(/\s+/)
}
