import { parse } from "../src/markdown-parser"
import * as core from "@actions/core"

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

    expect(parse(basic)).toEqual({
      staging: [
        {
          name: "branch1",
          extras: {
            branch: "branch1",
            author: "@yykamei",
            PR: "#123",
            Note: "This will be used until the end of October.",
          },
        },
        {
          name: "feature/add-something",
          extras: { branch: "feature/add-something", author: "@yykamei", PR: "#138", Note: null },
        },
      ],
      strawberry: [
        {
          name: "feature/add-something",
          extras: { Branch: "feature/add-something", author: "@yykamei", PR: "#138", Note: null },
        },
        {
          name: "branch2",
          extras: { Branch: "branch2", author: "@yykamei", PR: "#139", Note: null },
        },
        {
          name: "branch3",
          extras: { Branch: "branch3", author: "@yykamei", PR: "#140", Note: null },
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
    expect(parse(headingWithStrong)).toEqual({
      staging: [
        {
          name: "branch2",
          extras: { branch: "branch2", author: "@yykamei", PR: "#993", Note: null },
        },
        {
          name: "branch3",
          extras: { branch: "branch3", author: "@yykamei", PR: "#998", Note: null },
        },
      ],
    })
  })

  it("parses the markdown body including the heading with strong and en", () => {
    const headingWithStrong = `
## <strong>feature</strong>/<en>fire</en>
|branch|author|PR|Note|
|-------|--------|--|-----|
|branch4|@yykamei|#8|<p></p>|
`
    expect(parse(headingWithStrong)).toEqual({
      "feature/fire": [
        {
          name: "branch4",
          extras: { branch: "branch4", author: "@yykamei", PR: "#8", Note: null },
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
    expect(() => parse(broken)).toThrowError("Branch must exist in the table row")
  })

  it("throws an error because of broken markdown table", () => {
    const broken = `# HHH
|d|X|
|-|-|
|ok+++++++
`
    expect(() => parse(broken)).toThrowError("Branch must exist in the table row")
  })
})
