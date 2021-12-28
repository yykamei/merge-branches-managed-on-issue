// We are using the old version of unified, which does not have sufficient typing definitions.
// So, we explicitly disable `@typescript-eslint/no-explicit-any` to avoid "children does not exist".
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as core from "@actions/core"
import unified from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import remarkStringify from "remark-stringify"
import u from "unist-builder"

interface Parsed {
  readonly mergedBranches: MergedBranches
  readonly node: any
}

interface MergedBranches {
  [baseBranch: string]: TargetBranch[]
}

interface TargetBranch {
  readonly name: string
  readonly author: string | null
  readonly pull: string | null
  readonly extras: {
    readonly [key: string]: string
  }
}

export const parse = (body: string): Parsed => {
  core.debug("Start parse()")
  let currentBaseBranch: string | null = null
  const mergedBranches: MergedBranches = {}

  const result: any = unified().use(remarkParse).use(remarkGfm).parse(body)
  core.debug("We got the parsed markdown.")

  result.children.forEach((node: any) => {
    switch (node.type) {
      case "heading": {
        core.debug("We found the heading node.")
        currentBaseBranch = extractText(node)
        return
      }
      case "table": {
        core.debug("We found the table node.")
        if (currentBaseBranch != null) {
          mergedBranches[currentBaseBranch] = tableToTargetBranch(node)
        }
        return
      }
      default:
        return // Do nothing
    }
  })
  return { node: result, mergedBranches }
}

export const reformat = (body: string): string => {
  core.debug("Start reformat()")
  const { node } = parse(body)
  return unified().use(remarkGfm).use(remarkStringify).stringify(node)
}

interface AppendParams {
  readonly body: string
  readonly branch: string
  readonly author?: string
  readonly pr?: string
  readonly baseBranch?: string
}

export const append = ({ body, branch, author, pr, baseBranch }: AppendParams): string => {
  core.debug("Start append()")
  const parsed = parse(body)
  const root = parsed.node
  let currentBaseBranch: string | null = null

  root.children.forEach((node: any, idx: number) => {
    switch (node.type) {
      case "heading": {
        currentBaseBranch = extractText(node)
        return
      }
      case "table": {
        if (currentBaseBranch == null) {
          return
        }
        if (baseBranch != null && currentBaseBranch !== baseBranch) {
          return
        }
        const targetBranches = parsed.mergedBranches[currentBaseBranch]
        if (targetBranches == null) {
          return
        }
        if (targetBranches.find((t) => t.name === branch) != null) {
          // NOTE: Don't append more than once
          return
        }
        const headers = node.children.slice(0, 1).flatMap((c: any) => tableRowToArray(c))
        const tableCells = headers.map((h: string | null) => {
          if (isBranch(h)) {
            return u("tableCell", [u("text", branch)])
          } else if (isAuthor(h)) {
            return u("tableCell", [u("text", author || "")])
          } else if (isPR(h)) {
            return u("tableCell", [u("text", pr || "")])
          } else {
            return u("tableCell", [u("text", "")])
          }
        })
        const newRow = u("tableRow", tableCells)
        root.children[idx]!.children = [...node.children, newRow]
        return
      }
      default:
        return // Do nothing
    }
  })
  return unified().use(remarkGfm).use(remarkStringify).stringify(root)
}

export const remove = (body: string, branch: string, baseBranch?: string): string => {
  core.debug("Start remove()")
  const parsed = parse(body)
  const root = parsed.node
  let currentBaseBranch: string | null = null

  root.children.forEach((node: any, idx: number) => {
    switch (node.type) {
      case "heading": {
        currentBaseBranch = extractText(node)
        return
      }
      case "table": {
        if (currentBaseBranch == null) {
          return
        }
        if (baseBranch != null && currentBaseBranch !== baseBranch) {
          return
        }
        const targetBranches = parsed.mergedBranches[currentBaseBranch]
        if (targetBranches == null) {
          return
        }
        if (targetBranches.find((t: TargetBranch) => t.name === branch)) {
          const headers = node.children.slice(0, 1).flatMap((c: any) => tableRowToArray(c))
          const branchCol = headers.findIndex((h: string | null) => isBranch(h))
          root.children[idx]!.children = [
            ...node.children.slice(0, 1),
            ...node.children.slice(1).filter((c: any) => tableRowToArray(c)[branchCol] !== branch),
          ]
        }
        return
      }
      default:
        return // Do nothing
    }
  })
  return unified().use(remarkGfm).use(remarkStringify).stringify(root)
}

const tableToTargetBranch = (node: any): TargetBranch[] => {
  core.debug(`Start tableToTargetBranch()`)

  const rows = node.children.map((child: any) => {
    switch (child.type) {
      case "tableRow":
        return tableRowToArray(child)
      default:
        throw new Error('Invalid table was given. The direct children of "table" must be "tableRow"')
    }
  })
  const headers = rows[0]
  core.debug(`We could get the headers with these values: ${headers}`)

  return rows.slice(1).map((row: any) => {
    let name: string | null = null
    let author: string | null = null
    let pull: string | null = null
    const extras: any = {}

    console.log(row)
    row.forEach((v: any, idx: number) => {
      if (isBranch(headers[idx])) {
        if (v == null) {
          throw new Error("Branch must exist in the table row")
        }
        name = v
      } else if (isAuthor(headers[idx])) {
        author = v
      } else if (isPR(headers[idx])) {
        pull = v
      } else {
        extras[headers[idx]] = v
      }
    })
    if (name == null) {
      throw new Error("Branch must exist in the table row")
    }
    return {
      name,
      author,
      pull,
      extras,
    }
  })
}

const tableRowToArray = (node: any): (string | null)[] => {
  core.debug(`Start tableRowToArray()`)

  return node.children.map((child: any) => {
    switch (child.type) {
      case "tableCell":
        return extractText(child)
      default:
        throw new Error('Invalid table was given. The direct children of "tableRow" must be "tableCell"')
    }
  })
}

/**
 * This tries to extract the value of the "text" node.
 * If the value is an empty string, this returns `null`.
 *
 * @param node
 */
const extractText = (node: any): string | null => {
  core.debug(`Start extractText()`)

  if ("children" in node) {
    const result = node.children
      .map((child: any) => extractText(child))
      .filter((v: unknown) => v != null)
      .join("")
    const text = result.length > 0 ? result : null
    core.debug(`We could extract the text value: "${text}"`)
    return text
  }
  if (node.type === "text") {
    const result = node.value
    const text = result.length > 0 ? result : null
    core.debug(`We could extract the text value: "${text}"`)
    return text
  }
  core.debug("We could not extract the text value")
  return null
}

const isBranch = (s: string | undefined | null) => s?.toLocaleLowerCase() === "branch"
const isAuthor = (s: string | undefined | null) => s?.toLocaleLowerCase() === "author"
const isPR = (s: string | undefined | null) =>
  ["pr", "pull", "pull_request", "pullrequest"].find((c) => s?.toLocaleLowerCase() === c) != null
