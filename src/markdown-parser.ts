// We are using the old version of unified, which does not have sufficient typing definitions.
// So, we explicitly disable `@typescript-eslint/no-explicit-any` to avoid "children does not exist".
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as core from "@actions/core"
import unified from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import remarkStringify from "remark-stringify"

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

export const remove = (body: string, branch: string): string => {
  core.debug("Start remove()")
  const parsed = parse(body)
  const root = parsed.node

  root.children.forEach((node: any, idx: number) => {
    switch (node.type) {
      case "table": {
        for (const targetBranches of Object.values(parsed.mergedBranches)) {
          if (targetBranches.find((t: TargetBranch) => t.name === branch)) {
            const headers = node.children.slice(0, 1).flatMap((c: any) => tableRowToArray(c))
            const branchCol = headers.findIndex((h: string | null) => isBranch(h))
            root.children[idx]!.children = [
              ...node.children.slice(0, 1),
              ...node.children.slice(1).filter((c: any) => tableRowToArray(c)[branchCol] !== branch),
            ]
          }
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

    row.forEach((v: any, idx: number) => {
      if (isBranch(headers[idx])) {
        if (v == null) {
          throw new Error("Branch must exist in the table row")
        }
        name = v
      } else if (["author"].includes(headers[idx]?.toLowerCase())) {
        author = v
      } else if (["pr", "pull", "pull_request"].includes(headers[idx]?.toLowerCase())) {
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
