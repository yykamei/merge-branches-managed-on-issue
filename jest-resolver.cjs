const path = require("node:path")
const fs = require("node:fs")

function resolveEsmPackage(request, basedir) {
  const parts = request.split("/")
  const scope = parts[0].startsWith("@") ? parts.shift() : null
  const name = parts.shift()
  const packageName = scope ? `${scope}/${name}` : name
  const subpath = parts.length > 0 ? parts.join("/") : null

  let searchDir = basedir
  while (searchDir !== path.parse(searchDir).root) {
    const pkgJsonPath = path.join(searchDir, "node_modules", packageName, "package.json")
    if (fs.existsSync(pkgJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"))
      if (pkg.type === "module") {
        if (subpath) {
          return path.join(searchDir, "node_modules", packageName, subpath + (subpath.endsWith(".js") ? "" : ".js"))
        }
        return path.join(searchDir, "node_modules", packageName, pkg.main || "index.js")
      }
      break
    }
    searchDir = path.dirname(searchDir)
  }
  return null
}

module.exports = (request, options) => {
  const resolved = resolveEsmPackage(request, options.basedir)
  if (resolved && fs.existsSync(resolved)) {
    return resolved
  }
  return options.defaultResolver(request, options)
}
