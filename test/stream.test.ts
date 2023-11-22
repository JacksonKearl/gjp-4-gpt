import { describe, expect, test } from "bun:test"
import { IncompleteJsonOptions, IncompleteJson } from "../index.ts"
import { verifyIsValidPartial } from "./spec.test"
import { e1 } from "./utils.test.ts"

describe("spec-based stream tests", () => {
  test("plain literals", async () => {
    await testAllOptions(JSON.stringify(1989))
    await testAllOptions(JSON.stringify(true))
    await testAllOptions(JSON.stringify(false))
    await testAllOptions(JSON.stringify(null))
    await testAllOptions(JSON.stringify("Hello world! 🤷‍♀️"))
  })

  test("example object", async () => {
    await testAllOptions(JSON.stringify(e1)) // randomized chunking
    await testAllOptions(JSON.stringify(e1))
    await testAllOptions(JSON.stringify(e1))
  })

  test("tricky objects", async () => {
    await testAllOptions(
      JSON.stringify({
        'dfd"dfasd': "hello\\u1234567",
        'dfd\\"df\\u1234asd': "hello\\u1234567",
      }),
    )
  })

  test("internal consistency", () => {
    const ij = new IncompleteJson()
    ij.addChunk(`{ "name": "Bob Johnson", "age": 35, "isEmployee": true`)
    expect(() => ij.readValue()).not.toThrow()
  })
})

const testAllOptions = async (string: string) => {
  await testParseAllReadables(JSON.stringify(string), {})
  await testParseAllReadables(JSON.stringify(string), {
    prohibitPartialNumbers: true,
  })
  await testParseAllReadables(JSON.stringify(string), {
    prohibitPartialStrings: true,
  })
  await testParseAllReadables(JSON.stringify(string), {
    prohibitPartialStrings: true,
    prohibitPartialNumbers: true,
  })
}

const testParseAllReadables = async (
  fullString: string,
  options: IncompleteJsonOptions,
) => {
  const fullValue = JSON.parse(fullString)

  const chunks = [""]
  for (const char of fullString) {
    if (Math.random() < 0.1) {
      chunks.push("")
    }
    chunks[chunks.length - 1] += char
  }

  const stream = new TransformStream()

  void (async () => {
    const writer = stream.writable.getWriter()
    for (const chunk of chunks) {
      await writer.write(chunk)
    }
    await writer.close()
  })()

  const readable = IncompleteJson.fromReadable(stream.readable, options)

  let lastPartial
  for await (const partialValue of readable.values()) {
    if (lastPartial) {
      expect(partialValue).toBeDefined
    }

    if (partialValue) {
      verifyIsValidPartial(partialValue, fullValue, options)
      if (lastPartial) {
        expect(JSON.stringify(lastPartial).length).toBeLessThanOrEqual(
          JSON.stringify(partialValue).length,
        )
      }
      lastPartial = partialValue
    }
  }

  // verify final data is equal to desired
  expect(JSON.stringify(lastPartial)).toEqual(JSON.stringify(fullValue))
}
