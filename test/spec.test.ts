import { IncompleteJson, IncompleteJsonOptions } from "../index.ts"
import { e1, e2, verifyIsValidPartial } from "./utils.test.ts"

import { describe, expect, test } from "bun:test"

describe("spec-based parse tests", () => {
  test("simple examples", () => {
    testParseObjectAllOptions("hello world")
    testParseObjectAllOptions(true)
    testParseObjectAllOptions(false)
    testParseObjectAllOptions(null)
    testParseObjectAllOptions([])
    testParseObjectAllOptions([null, true, false, 1, "hello"])
    testParseObjectAllOptions({ abc: "123" })

    testParseAllPrefixes("1989", {})
    testParseAllPrefixes("1989", { prohibitPartialStrings: true })
  })

  test("tricky examples", () => {
    testParseObjectAllOptions({
      '"hello"world"!': 'Some " \tvalue! \n []]]] }}{{{}}}',
      "boop a \u1234!": { "\u2312": null },
      "\u1234!": 'Some " \tvalue! \n []]]] }}{{{}}}',
    })
    testParseObjectAllOptions("\u1234")
    testParseObjectAllOptions("\\u1234")
    testParseStringAllOptions('"hello\\u1234dfd"')
  })
  test("example object 1", () => {
    testParseObjectAllOptions(e1)
  })
  test("example object 2", () => {
    testParseObjectAllOptions(e2)
    testParseObjectAllOptions({ e2 })
    testParseObjectAllOptions([[e2]])
  })
})

const testParseObjectAllOptions = (object: any) => {
  const strs = [JSON.stringify(object), JSON.stringify(object, null, 2)]
  const opts: IncompleteJsonOptions[] = [
    {},
    { prohibitPartialNumbers: true },
    { prohibitPartialStrings: true },
    { prohibitPartialNumbers: true, prohibitPartialStrings: true },
  ]
  for (const str of strs) {
    for (const opt of opts) {
      testParseAllPrefixes(str, opt)
    }
  }
}

const testParseStringAllOptions = (str: string) => {
  const opts: IncompleteJsonOptions[] = [
    {},
    { prohibitPartialNumbers: true },
    { prohibitPartialStrings: true },
    { prohibitPartialNumbers: true, prohibitPartialStrings: true },
  ]

  for (const opt of opts) {
    testParseAllPrefixes(str, opt)
  }
}

const testParseAllPrefixes = (
  fullString: string,
  options: IncompleteJsonOptions,
) => {
  const fullValue = JSON.parse(fullString)

  // verify partial data always satisfies spec
  for (let i = 0; i <= fullString.length; i++) {
    const prefix = fullString.slice(0, i)
    const partialValue = IncompleteJson.parse(prefix, options)
    if (partialValue) {
      verifyIsValidPartial(partialValue, fullValue, options)
    }
  }

  // verify amount of data is monotonically increasing
  for (let i = 0; i < fullString.length; i++) {
    const a = JSON.stringify(
      IncompleteJson.parse(fullString.slice(0, i), options),
    )
    const b = JSON.stringify(
      IncompleteJson.parse(fullString.slice(0, i + 1), options),
    )
    if (a !== undefined) {
      expect(b).toBeDefined()
      expect(a.length).toBeLessThanOrEqual(b.length)
    }
  }

  // verify final data is equal to desired
  expect(JSON.stringify(IncompleteJson.parse(fullString, options))).toEqual(
    JSON.stringify(JSON.parse(fullString)),
  )
}
export { verifyIsValidPartial }
