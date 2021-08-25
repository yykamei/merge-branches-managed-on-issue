/**
 * This module is responsible for wrapping Exec commands.
 */

import { exec } from "@actions/exec"
import * as fs from "fs"
import * as os from "os"
import path from "path"
import type { Inputs } from "./inputs"

export interface Exec {
  readonly exec: (command: string, args: string[], env?: Env, ignoreReturnCode?: boolean) => Promise<Result>
  readonly script: (source: string, env?: Env, ignoreReturnCode?: boolean) => Promise<Result>
}

interface Env {
  readonly [k: string]: string
}

interface Result {
  readonly exitCode: number
  readonly stdout: string
}

interface Params {
  readonly workingDirectory: Inputs["workingDirectory"]
  readonly shell: Inputs["shell"]
}

export const buildExec = ({ workingDirectory: cwd, shell }: Params): Exec => {
  const defaultEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0", // Disable git prompt
    GCM_INTERACTIVE: "Never", // Disable prompting for git credential manager
  }

  return {
    async exec(command: string, args: string[], env: Env = {}, ignoreReturnCode = false): Promise<Result> {
      const buffers: string[] = []

      const options = {
        cwd,
        env: { ...defaultEnv, ...env },
        ignoreReturnCode,
        listeners: {
          stdout: (data: Buffer) => {
            buffers.push(data.toString())
          },
        },
      }
      const exitCode = await exec(command, args, options)
      const stdout = buffers.join("")
      return { exitCode, stdout }
    },

    async script(source: string, env: Env = {}, ignoreReturnCode = false): Promise<Result> {
      const buffers: string[] = []

      const options = {
        cwd,
        env: { ...defaultEnv, ...env },
        ignoreReturnCode,
        listeners: {
          stdout: (data: Buffer) => {
            buffers.push(data.toString())
          },
        },
      }

      if (shell[0]) {
        const prefix = path.join(os.tmpdir(), "before-merge")
        const src = path.join(fs.mkdtempSync(prefix), "script")
        fs.writeFileSync(src, source)
        let exitCode = 0
        try {
          exitCode = await exec(shell[0], [...shell.slice(1), src], options)
        } finally {
          fs.unlinkSync(src)
        }
        const stdout = buffers.join("")
        return { exitCode, stdout }
      }
      throw new Error(`The specified source could not be invoked because the shell is empty: ${shell}`)
    },
  }
}
