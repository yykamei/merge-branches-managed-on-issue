import * as core from "@actions/core"
import { append, parse, remove } from "../src/markdown-parser"

describe("parse", () => {
  beforeAll(() => {
    jest.spyOn(core, "debug").mockImplementation(jest.fn)
  })

  it("parses the basic markdown body", () => {
    const basic = `This is a markdown body.

## staging
| branch                | author   | PR   | Note                                        |
| --------------------- | -------- | ---- | ------------------------------------------- |
| branch1               | @yykamei | #123 | This will be used until the end of October. |
| feature/add-something | @yykamei | #138 |                                             |

## strawberry
| Branch                | author   | PR   | Note                                        |
| --------------------- | -------- | ---- | ------------------------------------------- |
| feature/add-something | @yykamei | #138 |                                             |
| branch2               | @yykamei | #139 |                                             |
| branch3               | @yykamei | #140 |                                             |
`

    expect(parse(basic).mergedBranches).toEqual({
      staging: [
        {
          name: "branch1",
          author: "@yykamei",
          pull: "#123",
          extras: {
            Note: "This will be used until the end of October.",
          },
        },
        {
          name: "feature/add-something",
          author: "@yykamei",
          pull: "#138",
          extras: { Note: null },
        },
      ],
      strawberry: [
        {
          name: "feature/add-something",
          author: "@yykamei",
          pull: "#138",
          extras: { Note: null },
        },
        {
          name: "branch2",
          author: "@yykamei",
          pull: "#139",
          extras: { Note: null },
        },
        {
          name: "branch3",
          author: "@yykamei",
          pull: "#140",
          extras: { Note: null },
        },
      ],
    })
  })

  it("parses the markdown body including the heading with strong", () => {
    const headingWithStrong = `
## **staging**

Hi, it's staging branch.
| branch                | author   | PR   | Note |
| --------------------- | -------- | ---- | -|
| branch2               | @yykamei | #993 |  |
| branch3               | @yykamei | #998 |  |
`
    expect(parse(headingWithStrong).mergedBranches).toEqual({
      staging: [
        {
          name: "branch2",
          author: "@yykamei",
          pull: "#993",
          extras: { Note: null },
        },
        {
          name: "branch3",
          author: "@yykamei",
          pull: "#998",
          extras: { Note: null },
        },
      ],
    })
  })

  it("parses the markdown body including the heading with strong and en", () => {
    const headingWithStrong = `
## <strong>feature</strong>/<en>fire</en>
|branch|author|Note|
|-------|--------|-----|
|branch4|@yykamei|<p></p>|
`
    expect(parse(headingWithStrong).mergedBranches).toEqual({
      "feature/fire": [
        {
          name: "branch4",
          author: "@yykamei",
          pull: null,
          extras: { Note: null },
        },
      ],
    })
  })

  it("throws an error because it does not have 'branch' header", () => {
    const broken = `# OK
|name|
|----|
|test|
`
    expect(() => parse(broken).mergedBranches).toThrow("Branch must exist in the table row")
  })

  it("throws an error because of broken markdown table", () => {
    const broken = `# HHH
|d|X|
|-|-|
|ok+++++++
`
    expect(() => parse(broken).mergedBranches).toThrow("Branch must exist in the table row")
  })
})

describe("append", () => {
  const body = `
| A | B |
| - | - |

## This is a markdown body.

## staging
| branch                | author   | PR   | Note                                        |
| --------------------- | -------- | ---- | ------------------------------------------- |
| branch2               | @yykamei | #123 | This will be used until the end of October. |
| feature/add-something | @yykamei | #138 |                                             |

## strawberry
| Branch                | author   | PR   | Note                                        |
| --------------------- | -------- | ---- | ------------------------------------------- |
| feature/add-something | @yykamei | #138 |                                             |
| branch2               | @yykamei | #139 |                                             |
| branch3               | @yykamei | #140 |                                             |
`

  it("appends a new branch to a specific baseBranch", () => {
    expect(append({ body, branch: "abc", baseBranch: "strawberry", author: "@foo", pr: "#893" })).toEqual(`| A | B |
| - | - |

## This is a markdown body.

## staging

| branch                | author   | PR   | Note                                        |
| --------------------- | -------- | ---- | ------------------------------------------- |
| branch2               | @yykamei | #123 | This will be used until the end of October. |
| feature/add-something | @yykamei | #138 |                                             |

## strawberry

| Branch                | author   | PR   | Note |
| --------------------- | -------- | ---- | ---- |
| feature/add-something | @yykamei | #138 |      |
| branch2               | @yykamei | #139 |      |
| branch3               | @yykamei | #140 |      |
| abc                   | @foo     | #893 |      |
`)
  })

  it("appends a branch to all baseBranches", () => {
    expect(append({ body, branch: "abc", author: "@foo", pr: "#893" })).toEqual(`| A | B |
| - | - |

## This is a markdown body.

## staging

| branch                | author   | PR   | Note                                        |
| --------------------- | -------- | ---- | ------------------------------------------- |
| branch2               | @yykamei | #123 | This will be used until the end of October. |
| feature/add-something | @yykamei | #138 |                                             |
| abc                   | @foo     | #893 |                                             |

## strawberry

| Branch                | author   | PR   | Note |
| --------------------- | -------- | ---- | ---- |
| feature/add-something | @yykamei | #138 |      |
| branch2               | @yykamei | #139 |      |
| branch3               | @yykamei | #140 |      |
| abc                   | @foo     | #893 |      |
`)
  })

  it("does not append a branch", () => {
    expect(append({ body, branch: "branch2", author: "@yykamei", pr: "#123" })).toEqual(`| A | B |
| - | - |

## This is a markdown body.

## staging

| branch                | author   | PR   | Note                                        |
| --------------------- | -------- | ---- | ------------------------------------------- |
| branch2               | @yykamei | #123 | This will be used until the end of October. |
| feature/add-something | @yykamei | #138 |                                             |

## strawberry

| Branch                | author   | PR   | Note |
| --------------------- | -------- | ---- | ---- |
| feature/add-something | @yykamei | #138 |      |
| branch2               | @yykamei | #139 |      |
| branch3               | @yykamei | #140 |      |
`)
  })

  it("appends a branch to only baseBranches that does not have the specified one", () => {
    expect(append({ body, branch: "branch3", author: "@yykamei", pr: "#140" })).toEqual(`| A | B |
| - | - |

## This is a markdown body.

## staging

| branch                | author   | PR   | Note                                        |
| --------------------- | -------- | ---- | ------------------------------------------- |
| branch2               | @yykamei | #123 | This will be used until the end of October. |
| feature/add-something | @yykamei | #138 |                                             |
| branch3               | @yykamei | #140 |                                             |

## strawberry

| Branch                | author   | PR   | Note |
| --------------------- | -------- | ---- | ---- |
| feature/add-something | @yykamei | #138 |      |
| branch2               | @yykamei | #139 |      |
| branch3               | @yykamei | #140 |      |
`)
  })
})

describe("remove", () => {
  const body = `This is a markdown body.

## staging

| branch                | author   | PR   | Note                                        |
| --------------------- | -------- | ---- | ------------------------------------------- |
| branch2               | @yykamei | #123 | This will be used until the end of October. |
| feature/add-something | @yykamei | #138 |                                             |

## strawberry

| Branch                | author   | PR   | Note |
| --------------------- | -------- | ---- | ---- |
| feature/add-something | @yykamei | #138 |      |
| branch2               | @yykamei | #139 |      |
| branch3               | @yykamei | #140 |      |
`

  it("removes the specified branch from the markdown table", () => {
    expect(remove(body, "branch2")).toEqual(`This is a markdown body.

## staging

| branch                | author   | PR   | Note |
| --------------------- | -------- | ---- | ---- |
| feature/add-something | @yykamei | #138 |      |

## strawberry

| Branch                | author   | PR   | Note |
| --------------------- | -------- | ---- | ---- |
| feature/add-something | @yykamei | #138 |      |
| branch3               | @yykamei | #140 |      |
`)
  })

  it("removes the specified branch from the specific baseBranch markdown table", () => {
    expect(remove(body, "branch2", "strawberry")).toEqual(`This is a markdown body.

## staging

| branch                | author   | PR   | Note                                        |
| --------------------- | -------- | ---- | ------------------------------------------- |
| branch2               | @yykamei | #123 | This will be used until the end of October. |
| feature/add-something | @yykamei | #138 |                                             |

## strawberry

| Branch                | author   | PR   | Note |
| --------------------- | -------- | ---- | ---- |
| feature/add-something | @yykamei | #138 |      |
| branch3               | @yykamei | #140 |      |
`)
  })

  it("does not remove because the specified branch does not exist", () => {
    expect(remove(body, "gone")).toEqual(body)
  })
})
