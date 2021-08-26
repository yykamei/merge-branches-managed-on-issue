import * as core from "@actions/core"
import { buildExec } from "./exec"
import type { Exec } from "./exec"
import type { Inputs } from "./inputs"

interface Params {
  readonly workingDirectory: Inputs["workingDirectory"]
  readonly shell: Inputs["shell"]
  readonly defaultBranch: string
  readonly baseBranch: string
  readonly targetBranches: string[]
  readonly modifiedBranchSuffix: string
  readonly force?: boolean
  readonly beforeMerge?: string | null
  readonly afterMerge?: string | null
}

export const merge = async (params: Params): Promise<string> => {
  const { workingDirectory, shell } = params
  const exec = buildExec({ workingDirectory, shell })
  await checkout(exec, params)
  await configureGit(exec)
  await reset(exec, params)

  await runScriptForBranches("before")(exec, params)
  await mergeTargets(exec, params)
  await runScriptForBranches("after")(exec, params)

  await push(exec, params)
  return await output(exec, params)
}

const checkout = async (
  { exec }: Exec,
  { baseBranch, targetBranches, modifiedBranchSuffix }: Params
): Promise<void> => {
  core.debug("Start checkout()")
  for (const target of targetBranches) {
    core.debug(`  checkout to ${target}...`)
    const branch = modifiedBranch(target, modifiedBranchSuffix)
    await exec("git", ["checkout", target])

    const { stdout } = await exec("git", ["branch", "--remotes", "--list", `origin/${branch}`])
    if (stdout.trim().length === 0) {
      core.debug(`  creating to ${branch}...`)
      await exec("git", ["checkout", "-b", branch])
      await exec("git", ["push", "origin", branch])
    }
  }

  const { stdout } = await exec("git", ["branch", "--remotes", "--list", `origin/${baseBranch}`])
  if (stdout.trim().length === 0) {
    core.debug(`  creating ${baseBranch}...`)
    await exec("git", ["checkout", "-b", baseBranch])
  } else {
    core.debug(`  checkout to ${baseBranch}...`)
    await exec("git", ["checkout", baseBranch])
  }
  core.debug("Finish checkout()")
}

const reset = async ({ exec }: Exec, { force, defaultBranch }: Params) => {
  core.debug("Start reset()")
  if (force) {
    core.debug("  reset!")
    await exec("git", ["reset", "--hard", `origin/${defaultBranch}`])
  }
  core.debug("Finish reset()")
}

const configureGit = async ({ exec }: Exec): Promise<void> => {
  core.debug("Start configureGit()")
  // TODO: `name` and `email` should be configurable.
  await exec("git", ["config", "user.name", "github-actions"])
  await exec("git", ["config", "user.email", "github-actions@github.com"])
  core.debug("Finish configureGit()")
}

const runScriptForBranches =
  (when: "before" | "after") =>
  async (
    { exec, script }: Exec,
    { beforeMerge, afterMerge, targetBranches, baseBranch, modifiedBranchSuffix }: Params
  ) => {
    core.debug("Start runScriptForBranches()")
    const source = when === "before" ? beforeMerge : afterMerge
    if (source == null) {
      core.debug("Finish runScriptForBranches() without executing")
      return
    }
    for (const target of targetBranches) {
      const branch = modifiedBranch(target, modifiedBranchSuffix)
      await exec("git", ["checkout", branch])

      core.debug(`  running the script on the branch "${branch}"...`)
      await script(source, { CURRENT_BRANCH: branch, BASE_BRANCH: baseBranch })

      core.debug(`  pushing ${branch}...`)
      await exec("git", ["push", "origin", branch])
    }
    await exec("git", ["checkout", baseBranch])

    core.debug(`  running the script on the branch "${baseBranch}"...`)
    await script(source, { CURRENT_BRANCH: baseBranch, BASE_BRANCH: baseBranch })
    // NOTE: baseBranch can be modified directly because it is managed by this action.
    core.debug("Finish runScriptForBranches()")
  }

const mergeTargets = async ({ exec }: Exec, { baseBranch, targetBranches, modifiedBranchSuffix }: Params) => {
  core.debug("Start mergeTargets()")
  for (const target of targetBranches) {
    const branch = modifiedBranch(target, modifiedBranchSuffix)
    const { exitCode } = await exec("git", ["merge", "--no-ff", "--no-edit", branch], {}, true)
    if (exitCode !== 0) {
      const { stdout: status } = await exec("git", ["status"], {}, true)
      const { stdout: diff } = await exec("git", ["diff"], {}, true)
      throw new Error(`The branch "${branch}" could not be merged into "${baseBranch}"
git-status(1):
${status}

git-diff(1):
${diff}

You might be able to resolve conflicts on your local machine 💻 with these commands:

git fetch
git checkout ${baseBranch}
git pull origin ${baseBranch}
git merge --no-ff origin/${branch}
# ===== Resolve the conflicts manually 🛠 =====
git add YOUR_CONFLICTED_FILES
git merge --continue
git push origin ${baseBranch}

After pushing the merge commit, Run this workflow again 💪
`)
    }
  }
  core.debug("Finish mergeTargets()")
}

const push = async ({ exec }: Exec, { force, baseBranch }: Params) => {
  core.debug("Start push()")
  if (force) {
    await exec("git", ["push", "--force", "origin", baseBranch])
  } else {
    await exec("git", ["push", "origin", baseBranch])
  }
  core.debug("Finish push()")
}

const output = async ({ exec }: Exec, { defaultBranch }: Params): Promise<string> => {
  const { stdout } = await exec("git", ["log", "--merges", "--oneline", `origin/${defaultBranch}...HEAD`])
  return stdout
}

const modifiedBranch = (branch: string, modifiedBranchSuffix: string): string => `${branch}${modifiedBranchSuffix}`
