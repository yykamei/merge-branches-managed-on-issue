const { transformSync } = require("@swc/core")

exports.process = (src, filename) => {
  const ext = filename.split(".").pop()
  const syntax = ext === "ts" || ext === "tsx" ? "typescript" : "ecmascript"

  const result = transformSync(src, {
    filename,
    sourceMaps: false,
    jsc: {
      parser: { syntax },
      target: "es2015",
    },
    module: { type: "commonjs" },
  })

  const code = result.code
    .replace(
      /Object\.defineProperty\(target,\s*name,\s*\{\s*enumerable:\s*true,\s*get:/g,
      "Object.defineProperty(target, name, { configurable: true, enumerable: true, get:",
    )
    .replace(
      /Object\.defineProperty\(exports,\s*"(\w+)",\s*\{\s*enumerable:\s*true,\s*get:/g,
      'Object.defineProperty(exports, "$1", { configurable: true, enumerable: true, get:',
    )

  return { code }
}
