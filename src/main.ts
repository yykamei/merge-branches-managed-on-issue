import { setFailed } from "@actions/core"

const run = async () => {}
const handleError = (err: unknown) => {
  setFailed(`Unhandled error: ${err}`)
}

process.on("unhandledRejection", handleError)
run().catch(handleError)
