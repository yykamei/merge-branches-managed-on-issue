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
  await configureGit(exec)
  await prepare(exec, params)

  await runScriptForBranches("before")(exec, params)
  await mergeTargets(exec, params)
  await runScriptForBranches("after")(exec, params)

  await push(exec, params)
  return await output(exec, params)
}

export const deleteBranch = async (
  target: string,
  { workingDirectory, shell, modifiedBranchSuffix }: Pick<Params, "workingDirectory" | "shell" | "modifiedBranchSuffix">
): Promise<void> => {
  const branch = modifiedBranch(target, modifiedBranchSuffix)
  const exec = buildExec({ workingDirectory, shell })
  await exec.exec("git", ["push", "--delete", "origin", branch], {}, true)
}

const prepare = async (
  { exec }: Exec,
  { force, baseBranch, defaultBranch, targetBranches, modifiedBranchSuffix }: Params
): Promise<void> => {
  const run = async (target: string, resetTarget: string, mergeUpstream = true) => {
    core.debug(`  checkout to ${target}...`)

    const { stdout: targetCheck } = await exec("git", ["branch", "--remotes", "--list", `origin/${resetTarget}`])
    if (targetCheck.trim().length === 0) {
      core.debug(`  creating ${resetTarget}...`)
      await exec("git", ["checkout", "-b", resetTarget])
      await exec("git", ["push", "origin", resetTarget])
    } else {
      await exec("git", ["checkout", resetTarget])
    }

    const { stdout } = await exec("git", ["branch", "--remotes", "--list", `origin/${target}`])
    if (stdout.trim().length === 0) {
      core.debug(`  creating ${target}...`)
      await exec("git", ["checkout", "-b", target])
      await exec("git", ["push", "origin", target])
    } else {
      core.debug(`  checkout to ${target}...`)
      await exec("git", ["checkout", target])
    }

    if (mergeUpstream && !force) {
      await exec("git", ["merge", "--no-ff", "--no-edit", `origin/${resetTarget}`])
    }

    if (force) {
      core.debug(`  reset ${target} forcefully with origin/${resetTarget}...`)
      await exec("git", ["reset", "--hard", `origin/${resetTarget}`])
      await exec("git", ["push", "--force", "origin", target])
    }
  }

  core.debug("Start prepare()")
  for (const target of targetBranches) {
    await run(modifiedBranch(target, modifiedBranchSuffix), target)
  }
  await run(baseBranch, defaultBranch, false)
  core.debug("Finish prepare()")
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
      await exec("git", ["push", "origin", baseBranch])
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

const push = async ({ exec }: Exec, { baseBranch, targetBranches, modifiedBranchSuffix }: Params) => {
  core.debug("Start push()")
  for (const branch of [...targetBranches.map((t) => modifiedBranch(t, modifiedBranchSuffix)), baseBranch]) {
    core.debug(`  pushing ${branch}`)
    await exec("git", ["push", "origin", branch])
  }
  core.debug("Finish push()")
}

const output = async ({ exec }: Exec, { defaultBranch }: Params): Promise<string> => {
  const { stdout } = await exec("git", ["log", "--merges", "--oneline", `origin/${defaultBranch}...HEAD`])
  return stdout
}

const modifiedBranch = (branch: string, modifiedBranchSuffix: string): string => `${branch}${modifiedBranchSuffix}`
