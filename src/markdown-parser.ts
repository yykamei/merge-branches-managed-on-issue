// We are using the old version of unified, which does not have sufficient typing definitions.
// So, we explicitly disable `@typescript-eslint/no-explicit-any` to avoid "children does not exist".
/* eslint-disable @typescript-eslint/no-explicit-any */

import unified from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"

interface MergedBranches {
  [baseBranch: string]: TargetBranch[]
}

interface TargetBranch {
  readonly name: string
  readonly extras: {
    readonly [key: string]: string
  }
}

export const parse = (body: string): MergedBranches => {
  let currentBaseBranch: string | null = null
  const mergedBranches: MergedBranches = {}

  const result: any = unified().use(remarkParse).use(remarkGfm).parse(body)
  result.children.forEach((node: any) => {
    switch (node.type) {
      case "heading": {
        currentBaseBranch = extractText(node)
        return
      }
      case "table": {
        if (currentBaseBranch != null) {
          mergedBranches[currentBaseBranch] = tableToTargetBranch(node)
        }
        return
      }
      default:
        return // Do nothing
    }
  })
  return mergedBranches
}

const tableToTargetBranch = (node: any): TargetBranch[] => {
  const rows = node.children.map((child: any) => {
    switch (child.type) {
      case "tableRow":
        return tableRowToArray(child)
      default:
        throw new Error('Invalid table was given. The direct children of "table" must be "tableRow"')
    }
  })
  const headers = rows[0]
  return rows.slice(1).map((row: any) => {
    let name: string | null = null
    const extras: any = {}

    row.forEach((v: any, idx: number) => {
      extras[headers[idx]] = v
      if (headers[idx] === "branch") {
        if (v == null) {
          throw new Error("Branch must exist in the table row")
        }
        name = v
      }
    })
    if (name == null) {
      throw new Error("Branch must exist in the table row")
    }
    return {
      name,
      extras,
    }
  })
}

const tableRowToArray = (node: any): (string | null)[] => {
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
  if ("children" in node) {
    const result = node.children
      .map((child: any) => extractText(child))
      .filter((v: unknown) => v != null)
      .join("")
    return result.length > 0 ? result : null
  }
  if (node.type === "text") {
    const result = node.value
    return result.length > 0 ? result : null
  }
  return null
}
