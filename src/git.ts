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
  const {
    workingDirectory,
    shell,
    beforeMerge,
    baseBranch,
    defaultBranch,
    targetBranches,
    modifiedBranchSuffix,
    force = false,
  } = params
  const exec = buildExec({ workingDirectory, shell })

  await configureGit(exec)
  await prepareBranch(exec, baseBranch, defaultBranch, force)
  for (const target of targetBranches) {
    await prepareBranch(exec, modifiedBranch(target, modifiedBranchSuffix, baseBranch), target, force)
    await mergeUpstream(exec, modifiedBranch(target, modifiedBranchSuffix, baseBranch), target, beforeMerge)
  }

  await runBeforeMerge(exec, params)
  await mergeTargets(exec, params)
  await runAfterMerge(exec, params)
  await pushBaseBranch(exec, params)

  return await output(exec, params)
}

export const deleteBranch = async (
  target: string,
  {
    workingDirectory,
    shell,
    modifiedBranchSuffix,
    baseBranch,
  }: Pick<Params, "workingDirectory" | "shell" | "modifiedBranchSuffix" | "baseBranch">
): Promise<void> => {
  const exec = buildExec({ workingDirectory, shell })
  const branch = modifiedBranch(target, modifiedBranchSuffix, baseBranch)
  const oldBranch = oldModifiedBranch(target, modifiedBranchSuffix)
  await exec.exec("git", ["push", "--delete", "origin", branch], {}, true)
  await exec.exec("git", ["push", "--delete", "origin", oldBranch], {}, true)
}

const configureGit = async ({ exec }: Exec): Promise<void> => {
  // TODO: `name` and `email` should be configurable.
  await exec("git", ["config", "user.name", "github-actions"])
  await exec("git", ["config", "user.email", "github-actions@github.com"])
}

const prepareBranch = async ({ exec }: Exec, dest: string, src: string, force: boolean): Promise<void> => {
  const { stdout: targetCheck } = await exec("git", ["branch", "--remotes", "--list", `origin/${dest}`])
  if (targetCheck.trim().length === 0) {
    await exec("git", ["checkout", "-b", dest, `origin/${src}`])
    await exec("git", ["push", "origin", dest])
  } else {
    await exec("git", ["checkout", dest])
  }

  if (force) {
    await exec("git", ["reset", "--hard", `origin/${src}`])
    await exec("git", ["push", "--force", "origin", dest])
  }
}

const mergeUpstream = async (
  { exec, script }: Exec,
  dest: string,
  src: string,
  beforeMerge?: string | null
): Promise<void> => {
  await exec("git", ["checkout", src])
  if (beforeMerge != null) {
    await script(beforeMerge, { CURRENT_BRANCH: src, BASE_BRANCH: src })
  }

  await exec("git", ["checkout", dest])
  if (beforeMerge != null) {
    await script(beforeMerge, { CURRENT_BRANCH: dest, BASE_BRANCH: src })
  }

  const { exitCode } = await exec("git", ["merge", "--no-ff", "--no-edit", src], {}, true)
  if (exitCode !== 0) {
    core.warning(
      `We failed to merge the upstream "${src}" to "${dest}". We're about to recreate "${dest}" from "${src}".`
    )
    await exec("git", ["merge", "--abort"])
    await exec("git", ["checkout", src])
    await exec("git", ["branch", "-D", dest])
    await exec("git", ["checkout", "-b", dest])
    await exec("git", ["push", "--force", "origin", dest])
  } else {
    await exec("git", ["push", "origin", dest])
  }
}

const runBeforeMerge = async ({ exec, script }: Exec, { baseBranch, beforeMerge }: Params): Promise<void> => {
  if (beforeMerge != null) {
    await exec("git", ["checkout", baseBranch])
    await script(beforeMerge, { CURRENT_BRANCH: baseBranch, BASE_BRANCH: baseBranch })
  }
}

const runAfterMerge = async ({ exec, script }: Exec, { baseBranch, afterMerge }: Params): Promise<void> => {
  if (afterMerge != null) {
    await exec("git", ["checkout", baseBranch])
    await script(afterMerge, { CURRENT_BRANCH: baseBranch, BASE_BRANCH: baseBranch })
  }
}

const mergeTargets = async (
  { exec }: Exec,
  { defaultBranch, baseBranch, targetBranches, modifiedBranchSuffix }: Params
) => {
  await exec("git", ["checkout", baseBranch])
  for (const target of targetBranches) {
    const branch = modifiedBranch(target, modifiedBranchSuffix, baseBranch)
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
git checkout ${defaultBranch}
git branch -D ${baseBranch}
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
}

const pushBaseBranch = async ({ exec }: Exec, { baseBranch }: Params): Promise<void> => {
  await exec("git", ["checkout", baseBranch])
  await exec("git", ["push", "origin", baseBranch])
}

const output = async ({ exec }: Exec, { defaultBranch }: Params): Promise<string> => {
  const { stdout } = await exec("git", ["log", "--merges", "--oneline", `origin/${defaultBranch}...HEAD`])
  return stdout
}

const oldModifiedBranch = (branch: string, modifiedBranchSuffix: string): string => `${branch}${modifiedBranchSuffix}`

const modifiedBranch = (branch: string, modifiedBranchSuffix: string, baseBranch: string): string =>
  `${branch}${modifiedBranchSuffix}-${baseBranch}`
