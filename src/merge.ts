import { buildExec } from "./exec"
import type { Exec } from "./exec"
import type { Inputs } from "./inputs"

interface Params {
  readonly workingDirectory: Inputs["workingDirectory"]
  readonly shell: Inputs["shell"]
  readonly defaultBranch: string
  readonly baseBranch: string
  readonly targetBranches: string[]
  readonly force?: boolean
  readonly beforeMerge?: string | null
  readonly afterMerge?: string | null
}

export const merge = async ({
  workingDirectory,
  shell,
  defaultBranch,
  baseBranch,
  targetBranches,
  force = false,
  beforeMerge,
  afterMerge,
}: Params): Promise<string> => {
  const exec = buildExec({ workingDirectory, shell })
  await checkout(exec, baseBranch)
  await configureGit(exec)

  if (force) {
    await exec.exec("git", ["reset", "--hard", `origin/${defaultBranch}`])
  }

  if (beforeMerge != null) {
    await runScriptForBranches(exec, beforeMerge, [...targetBranches, baseBranch])
    await exec.exec("git", ["checkout", baseBranch])
  }

  await mergeTargets(exec, baseBranch, targetBranches)

  if (afterMerge != null) {
    await runScriptForBranches(exec, afterMerge, [...targetBranches, baseBranch])
    await exec.exec("git", ["checkout", baseBranch])
  }

  if (force) {
    await exec.exec("git", ["push", "--force", "origin", baseBranch])
  } else {
    await exec.exec("git", ["push", "origin", baseBranch])
  }

  const { stdout: gitLog } = await exec.exec("git", ["log", "--merges", "--oneline", `origin/${defaultBranch}...HEAD`])
  return gitLog
}

const checkout = async ({ exec }: Exec, baseBranch: string): Promise<void> => {
  const { stdout } = await exec("git", ["branch", "--remotes", "--list", `origin/${baseBranch}`])
  if (stdout.trim().length === 0) {
    await exec("git", ["checkout", "-b", baseBranch])
  } else {
    await exec("git", ["checkout", baseBranch])
  }
}

const configureGit = async ({ exec }: Exec): Promise<void> => {
  // TODO: `name` and `email` should be configurable.
  await exec("git", ["config", "user.name", "github-actions"])
  await exec("git", ["config", "user.email", "github-actions@github.com"])
}

const runScriptForBranches = async ({ exec, script }: Exec, source: string, branches: string[]) => {
  for (const branch of branches) {
    await exec("git", ["checkout", branch])
    await script(source, { CURRENT_BRANCH: branch })
  }
}

const mergeTargets = async ({ exec }: Exec, baseBranch: string, targetBranches: string[]) => {
  for (const target of targetBranches) {
    const { exitCode } = await exec("git", ["merge", "--no-ff", "--no-edit", `origin/${target}`], {}, true)
    if (exitCode !== 0) {
      throw new Error(`The branch "${target}" could not be merged into "${baseBranch}"
You might be able to resolve conflicts on your local machine 💻 with these commands:

git fetch
git checkout ${baseBranch}
git pull origin ${baseBranch}
git merge --no-ff origin/${target}
# ===== Resolve the conflicts manually 🛠 =====
git add YOUR_CONFLICTED_FILES
git merge --continue
git push origin ${baseBranch}

After pushing the merge commit, Run this workflow again 💪
`)
    }
  }
}
