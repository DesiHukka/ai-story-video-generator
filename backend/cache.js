// cache.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CACHE_DIR = path.join(__dirname, "cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);

/**
 * Build a SHA1 key from any number of strings.
 */
function makeKey(...parts) {
  return crypto.createHash("sha1").update(parts.join("||")).digest("hex");
}

/**
 * Look up JSON or binary file in cache; if missing, run `fn()` to produce it,
 * then write it and return the result.
 *
 * - type = 'json'  will do JSON.stringify/parse
 * - type = 'binary' will always write to a file and return that file's path
 */
async function cached(keyParts, fn, type = "json") {
  const key = makeKey(...keyParts);
  const jsonFile = path.join(CACHE_DIR, key + ".json");
  const binFile = path.join(CACHE_DIR, key);

  // 1) cache-hit?
  if (type === "json" && fs.existsSync(jsonFile)) {
    console.log(`[cache] HIT ${key} (json)`);
    return JSON.parse(fs.readFileSync(jsonFile, "utf-8"));
  }
  if (type === "binary" && fs.existsSync(binFile)) {
    console.log(`[cache] HIT ${key} (binary) → ${binFile}`);
    return binFile;
  }

  // 2) cache-miss → compute
  console.log(`[cache] MISS ${key}`);
  const result = await fn();

  if (type === "json") {
    fs.writeFileSync(jsonFile, JSON.stringify(result, null, 2), "utf-8");
    return result;
  }

  // type === 'binary'
  // result should be either a Buffer or a filepath
  if (Buffer.isBuffer(result)) {
    fs.writeFileSync(binFile, result);
  } else if (typeof result === "string" && fs.existsSync(result)) {
    fs.copyFileSync(result, binFile);
  } else {
    throw new Error(
      `cached(..., type='binary') fn() must return a Buffer or a valid filepath`
    );
  }
  return binFile;
}

module.exports = { cached };
