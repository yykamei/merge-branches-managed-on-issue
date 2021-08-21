import { setFailed } from "@actions/core"
import { run } from "./run"

const handleError = (err: unknown) => {
  setFailed(`Unhandled error: ${err}`)
}

process.on("unhandledRejection", handleError)
run().catch(handleError)
