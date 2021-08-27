# Merge Branches Managed on Issue

Merge Branches Managed on Issue is a tool to merge listed branches on an issue into the specified branch. I intend this tool would be used to manage a "staging" branch among many team members. Consider the case the "staging" environment of your application exists in a single place, and many members want to test their changes on the same "staging" environment at the same time. The deployment for the staging is usually based on a single Git commit/branch/tag, so the team members have to merge their changes into a single branch. In this case, they have to carefully manage their branches and describe what branches are deployed to the "staging" environment like this:

| branch                     | author    | PR    | note                                   |
| -------------------------- | --------- | ----- | -------------------------------------- |
| feature/add-special-button | \@yykamei | \#122 | This will be tested until September 3. |
| refactor-top-page          | \@octocat | \#132 |                                        |

This tool will automatically parse such a managed table on a GitHub issue and merge branches carefully.

## Usage

Create a GitHub issue and write its body like this:

```markdown
## staging

| branch      | author   | PR  | note |
| ----------- | -------- | --- | ---- |
| add-button  | @yykamei | #78 |      |
| add-special | @yykamei | #79 |      |

## production-ready

| branch     | author   | PR  | note |
| ---------- | -------- | --- | ---- |
| add-button | @yykamei | #78 |      |
```

The heading of the markdown means the name of "base branch", which will include merge commits from listed in the markdown table. In this case, `add-button` and `add-special` will be merged into `staging`, and `add-button` will be merged into `production-ready`.

**IMPORTANT: the markdown table must have `branch` in its headers.**

After creating an issue, configure this tool with the following workflow:

```yaml
name: Merge Branches Managed on Issue
on:
  workflow_dispatch:
    inputs:
      base-branch:
        description: base-branch
        required: true
      force:
        description: force
        required: false
        default: "false"

jobs:
  merge:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
        with:
          fetch-depth: 0

      - uses: yykamei/merge-branches-managed-on-issue@main
        with:
          issue-number: 1234 # <== This is the previously created issue's number
```

If you want to avoid predicatable conflicts, put your scripts in `before-merge` and/or `after-merge`. This is an example of these parameters. This case considers YOUR-PRIVATE-GEM will be always conflicted among developers, so it first changes `Gemfile` and `Gemfile.lock` to the same state before merging, and then it makes the merged branch (`staging`) refer to its namesake of YOUR-PRIVATE-GEM.

```yaml
name: Merge Branches Managed on Issue
on:
  workflow_dispatch:
    inputs:
      base-branch:
        description: base-branch
        required: true
      force:
        description: force
        required: false
        default: "false"

jobs:
  merge:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
        with:
          fetch-depth: 0

      - uses: ruby/setup-ruby@v1
        with:
          ruby-version: 3

      - uses: yykamei/merge-branches-managed-on-issue@main
        with:
          issue-number: 1
          shell: bash -exuo pipefail
          before-merge: |
            sed -i -e "s#^gem.*YOUR-PRIVATE-GEM.*\$#gem 'YOUR-PRIVATE-GEM', github: 'your-org/YOUR-PRIVATE-GEM', branch: 'main'#" Gemfile
            bundle lock --update YOUR-PRIVATE-GEM --conservative
            git add Gemfile Gemfile.lock
            if [[ $(git diff --cached | wc -l) == 0 ]]; then
              exit 0
            fi
            git commit --message="Change the version of YOUR-PRIVATE-GEM to refer to the main" --no-edit
          after-merge: |
            if [[ "${BASE_BRANCH}" != "${CURRENT_BRANCH}" ]]; then
              exit 0
            fi
            sed -i -e "s#^gem.*YOUR-PRIVATE-GEM.*\$#gem 'YOUR-PRIVATE-GEM', github: 'your-org/YOUR-PRIVATE-GEM', branch: 'staging'#" Gemfile
            bundle lock --update YOUR-PRIVATE-GEM --conservative
            git add Gemfile Gemfile.lock
            git commit --message="Change the version of YOUR-PRIVATE-GEM to refer to staging" --no-edit
```

After configuring the workflow, go to the GitHub Actions page and select the workflow name, which is "Merge Branches Managed on Issue" in this example, and trigger the workflow with the branch name.

<img width="280" alt="Trigger the workflow through workflow_dispatch" src="https://user-images.githubusercontent.com/13130705/131052572-37b7a95a-d514-4100-a28d-eece6693aaf4.png">

You should get the merged branch! That's it 🚀

### Action inputs

These are all available inputs.

| Name                     | Description                                                                                                                                                                                                                                                | Required | Default             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------- |
| issue-number             | The GitHub issue number in which the branches are listed                                                                                                                                                                                                   | `true`   | -                   |
| path                     | Relative path under `$GITHUB_WORKSPACE` to place the repository                                                                                                                                                                                            | `false`  | `.`                 |
| shell                    | The shell command to invoke a specified source code. This is typically used for `before-merge` option. The default is `bash -eo pipefail` on Linux. Currently, the Windows platform is not supported. Note this value will be just splitted by whitespaces | `false`  | `bash -eo pipefail` |
| before-merge             | Script that will be run before merging through the `shell` option. This will be invoked after checking out to each target and the base branch, so you can modify commits for each branch. This is useful to avoid possible merge conflicts                 | `false`  | `""`                |
| after-merge              | Script that will be run after merging through the `shell` option. This will be invoked after checking out to each target and the base branch, so you can modify commits for each branch                                                                    | `false`  | `""`                |
| inputs-param-base-branch | The name for a base branch in the workflow_dispatch action                                                                                                                                                                                                 | `false`  | `base-branch`       |
| inputs-param-force       | The name for force option in the workflow_dispatch action                                                                                                                                                                                                  | `false`  | `force`             |
| modified-branch-suffix   | The suffix for the modified branch. If you don't set `before-merge` or `after-merge`, the modified branch and the original branch will be the same                                                                                                         | `false`  | `.modified`         |
| token                    | The GitHub token used to create an authenticated client                                                                                                                                                                                                    | `false`  | `GITHUB_TOKEN`      |

## FAQ

### What should I do when some of branches listed change?

TBD

### What should I do when some of branches listed are deleted?

TBD

## Contributing

Please take a look at
the [CONTRIBUTING.md](https://github.com/yykamei/block-merge-based-on-time/blob/main/CONTRIBUTING.md). It's always a
pleasure to receive any contributions 😄
