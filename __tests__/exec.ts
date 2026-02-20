import * as os from "node:os"
import { buildExec } from "../src/exec"

describe("buildExec", () => {
  it("creates Exec", () => {
    const exec = buildExec({ workingDirectory: os.tmpdir(), shell: ["bash", "-e"] })
    expect(Object.keys(exec)).toEqual(expect.arrayContaining(["exec", "script"]))
  })

  describe("exec", () => {
    const { exec } = buildExec({ workingDirectory: os.tmpdir(), shell: ["bash", "-e"] })

    it("successfully invokes the command", async () => {
      const result = await exec("echo", ["OK", "TEST"])
      expect(result).toEqual({ exitCode: 0, stdout: "OK TEST\n" })
    })

    it("throws an error because of the command failure", async () => {
      try {
        await exec("cat", ["nonexistent"])
      } catch (e: unknown) {
        expect(e).toBeInstanceOf(Error)
      }
    })

    it("exits with non-zero status", async () => {
      const result = await exec("cat", ["nonexistent"], {}, true)
      expect(result).toEqual({ exitCode: 1, stdout: "" })
    })
  })

  describe("script", () => {
    const { script } = buildExec({ workingDirectory: os.tmpdir(), shell: ["bash", "-e"] })

    it("successfully runs the source", async () => {
      const result = await script(`X=(a b c d e)
for v in "\${X[@]}"; do
  echo "VALUE=$v"
done
echo "This message is output to stderr" >&2
echo Done
`)
      expect(result).toEqual({ exitCode: 0, stdout: "VALUE=a\nVALUE=b\nVALUE=c\nVALUE=d\nVALUE=e\nDone\n" })
    })

    it("throws an error because of the script failure", async () => {
      try {
        await script("cat nonexistent")
      } catch (e: unknown) {
        expect(e).toBeInstanceOf(Error)
      }
    })

    it("exits with non-zero status", async () => {
      const result = await script("cat nonexistent", {}, true)
      expect(result).toEqual({ exitCode: 1, stdout: "" })
    })
  })
})
