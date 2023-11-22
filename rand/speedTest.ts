import { IncompleteJson } from "../index.js"
import { parseJSON } from "./simplisticVanillaJSONParser.js"
import { readFileSync } from "fs"

let start = performance.now()

// const file = readFileSync("./5MB.json")
const text = readFileSync("./64KB.json", "utf-8")
// const text = await file.text()
console.log("file read: ", performance.now() - start)
start = performance.now()
const json = JSON.parse(text)
console.log("json parse: ", performance.now() - start)
start = performance.now()
const iJson = IncompleteJson.parse(text, {
  // prohibitPartialStrings: true,
  // prohibitPartialNumbers: true,
})
console.log("iJson parse: ", performance.now() - start)
start = performance.now()
let c = 0
let s = []
let str = false
for (let i = 0; i < text.length; i++) {
  const char = text[i]
  if (str) {
    if (char === "\\") i++
    if (char === '"') str = !str
  } else {
    if (char === "{") s.push("}")
    if (char === "[") s.push("]")
    if (char === "}") s.pop()
    if (char === "]") s.pop()
  }
}
console.log("simplest: ", performance.now() - start)
start = performance.now()
const sJSON = parseJSON(text)
console.log("simple parser: ", performance.now() - start)
