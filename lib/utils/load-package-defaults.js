
module.exports = loadPackageDefaults

var path = require("path")
  , log = require("./log")
  , find = require("./find")
  , asyncMap = require("./async-map")
  , npm = require("../../npm")
  , fs = require("./graceful-fs")

function loadPackageDefaults (pkg, cb) {
  readDefaultDirs(pkg, function (er) {
    if (er) return cb(er)
    asyncMap
      ( [pkg]
      , function (pkg, cb) { log.verbose(pkg._id, "loadDefaults", cb) }
      , readDefaultModules
      , readDefaultBins
      , readDefaultMans
      , function (er) { cb(er, pkg) }
      )
  })
}

function readDefaultDirs (pkg, cb) {
  var dirs = pkg.directories = pkg.directories || {}
    , pkgDir = path.join(npm.dir, pkg.name, pkg.version, "package")
    , defaults =
      { lib : "./lib"
      , bin : "./bin"
      , man : "./man"
      , doc : "./doc"
      }
  asyncMap(Object.keys(defaults), function (d, cb) {
    if (dirs[d]) return cb()
    fs.stat(path.join(pkgDir, defaults[d]), function (er, s) {
      if (s && s.isDirectory()) dirs[d] = defaults[d]
      cb()
    })
  }, cb)
}

function readDefaultMans (pkg, cb) {
  var man = pkg.directories && pkg.directories.man
    , pkgDir = path.join(npm.dir, pkg.name, pkg.version, "package")
    , manDir = path.join(pkgDir, man)
  if (pkg.man && !Array.isArray(pkg.man)) pkg.man = [pkg.man]
  if (pkg.man || !man) return cb(null, pkg)
  find(manDir, /\.[0-9]+(\.gz)?$/, function (er, filenames) {
    if (er) return cb(er)
    pkg.man = filenames.map(function (filename) {
      var f = path.basename(filename)
      return filename.substr(pkgDir.length + 1)
    })
    cb(null,pkg)
  })
}

// shim ROOT/{name}-{version}/**/*.js to ROOT/.npm/{name}/{version}/{lib}/**/*.js
function readDefaultModules (pkg, cb) {
  log.verbose(pkg._id, "readDefaultModules")
  var lib = pkg.directories && pkg.directories.lib || pkg.lib
    , pkgDir = path.join(npm.dir, pkg.name, pkg.version, "package")
    , libDir = path.join(pkgDir, lib).replace(/\/+$/, '')
  if (pkg.modules || !lib) return cb(null, pkg)
  // create a modules hash from the lib folder.
  pkg.modules = {}
  find(libDir, function (er, filenames) {
    if (er) return cb(er)
    filenames.forEach(function (filename) {
      log.silly(filename, pkg._id+" lib file")
      // filename = path.basename(filename, path.extname(filename))
      var key = filename.substr(libDir.length + 1)
        , val = filename.substr(pkgDir.length + 1)
      key = key.replace(/\.node$/, ".js")
      log.silly(key+"="+val, "module")
      if (key.length && val.length) pkg.modules[key] = val
    })
    // require("foo/foo") is dumb, and happens a lot.
    var nameMod = pkg.modules[pkg.name] || pkg.modules[pkg.name+".js"]
    if (!pkg.main
        && !pkg.modules.index
        && !pkg.modules["index.js"]
        && nameMod) {
      pkg.modules["index.js"] = nameMod
    }
    log.silly(pkg.modules, pkg._id+".modules")
    return cb(null, pkg)
  })
}
function readDefaultBins (pkg, cb) {
  var binDir = pkg.directories && pkg.directories.bin
  if (pkg.bin || !binDir) return cb(null, pkg)
  log.verbose("linking default bins", pkg._id)
  var pkgDir = path.join(npm.dir, pkg.name, pkg.version, "package")
  binDir = path.join(pkgDir, binDir)
  pkg.bin = {}
  find(binDir, function (er, filenames) {
    log.silly(filenames, "default bins")
    if (er) return cb(er)
    filenames.forEach(function (filename) {
      var key = filename.substr(binDir.length + 1)
                        .replace(/\.(js|node)$/, '')
        , val = filename.substr(pkgDir.length + 1)
      if (key.length && val.length) pkg.bin[key] = val
    })
    log.silly(pkg.bin, pkg._id+".bin")
    cb(null, pkg)
  })
}

