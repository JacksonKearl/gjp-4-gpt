import { IncompleteJson, ItemDoneStreaming } from "../index.ts"
import { describe, expect, test } from "bun:test"

describe("IncompleteJson.parse", () => {
  test("defaults", () => {
    const tests = [
      { input: "", output: undefined },
      { input: '"', output: "" },

      { input: "n", output: undefined },
      { input: "nu", output: undefined },
      { input: "nul", output: undefined },
      { input: "null", output: null },

      { input: "tru", output: undefined },
      { input: "true", output: true },
      { input: "fals", output: undefined },
      { input: "false", output: false },

      { input: "0", output: 0 },
      { input: "-", output: undefined },
      { input: "1", output: 1 },
      { input: "-1", output: -1 },
      { input: "-1.", output: -1 },
      { input: "-1.3", output: -1.3 },
      { input: "-1.3e", output: -1.3 },
      { input: "-1.3e2", output: -130 },
      { input: "-1.3E", output: -1.3 },
      { input: "-1.3E2", output: -130 },
      { input: "-1.3E+", output: -1.3 },
      { input: "-1.3E+2", output: -130 },
      { input: "-1.3E-", output: -1.3 },
      { input: "-1.3E-2", output: -0.013 },

      { input: "[", output: [] },
      { input: "[0", output: [0] },
      { input: "[1", output: [1] },
      { input: "[12", output: [12] },
      { input: "[12.", output: [12] },
      { input: "[12.3", output: [12.3] },
      { input: "[0]", output: [0] },
      { input: '["', output: [""] },
      { input: "[0,", output: [0] },

      { input: "{", output: {} },
      { input: '{"a', output: {} },
      { input: '{"a"', output: {} },
      { input: '{"a": ', output: {} },
      { input: '{"a": 0', output: { a: 0 } },
      { input: '{"a": 0,', output: { a: 0 } },
      { input: '{"a": "', output: { a: "" } },
      { input: '{"a": "b', output: { a: "b" } },
      { input: '{"a": "b"', output: { a: "b" } },
      { input: '{"a": "b",', output: { a: "b" } },

      { input: `{"key": true`, output: { key: true } },
      { input: `{"key": false`, output: { key: false } },
      { input: `{"key": null`, output: { key: null } },

      { input: "[{", output: [{}] },
      { input: '[{"', output: [{}] },
      { input: '[{"a', output: [{}] },
      { input: '[{"a"', output: [{}] },
      { input: '[{"a": ', output: [{}] },
      { input: '[{"a": 0', output: [{ a: 0 }] },
      { input: '[{"a": 0, ', output: [{ a: 0 }] },
      { input: '[{"a": 0, "', output: [{ a: 0 }] },
      { input: '[{"a": 0, "b', output: [{ a: 0 }] },
      { input: '[{"a": 0, "b"', output: [{ a: 0 }] },
      { input: '[{"a": 0, "b":', output: [{ a: 0 }] },
      { input: '[{"a": 0, "b": 1', output: [{ a: 0, b: 1 }] },

      { input: "[{},", output: [{}] },
      { input: "[{},1", output: [{}, 1] },
      { input: '[{},"', output: [{}, ""] },
      { input: '[{},"abc', output: [{}, "abc"] },
    ]

    for (const test of tests) {
      const actual = JSON.stringify(IncompleteJson.parse(test.input))
      const expected = JSON.stringify(test.output)

      expect(actual).toEqual(expected)
    }
  })

  test("prohibitPartialStrings", () => {
    const tests = [
      { input: "", output: undefined },
      { input: '"', output: undefined },

      { input: "n", output: undefined },
      { input: "nu", output: undefined },
      { input: "nul", output: undefined },
      { input: "null", output: null },

      { input: "tru", output: undefined },
      { input: "true", output: true },
      { input: "fals", output: undefined },
      { input: "false", output: false },

      { input: "[", output: [] },
      { input: "[0", output: [0] },
      { input: "[0]", output: [0] },
      { input: '["', output: [] },
      { input: "[0,", output: [0] },

      { input: "[0,", output: [0] },
      { input: "[1,", output: [1] },
      { input: "[-1,", output: [-1] },
      { input: "[-1.3,", output: [-1.3] },
      { input: "[-1.3e2,", output: [-130] },
      { input: "[-1.3E2,", output: [-130] },
      { input: "[-1.3E+2,", output: [-130] },
      { input: "[-1.3E-2,", output: [-0.013] },

      { input: "{", output: {} },
      { input: '{"a', output: {} },
      { input: '{"a"', output: {} },
      { input: '{"a": ', output: {} },
      { input: '{"a": 0', output: { a: 0 } },
      { input: '{"a": 0,', output: { a: 0 } },
      { input: '{"a": "', output: {} },
      { input: '{"a": "b', output: {} },
      { input: '{"a": "b"', output: { a: "b" } },
      { input: '{"a": "b",', output: { a: "b" } },

      { input: "[{", output: [{}] },
      { input: '[{"', output: [{}] },
      { input: '[{"a', output: [{}] },
      { input: '[{"a"', output: [{}] },
      { input: '[{"a": ', output: [{}] },
      { input: '[{"a": 0', output: [{ a: 0 }] },
      { input: '[{"a": 0, ', output: [{ a: 0 }] },
      { input: '[{"a": 0, "', output: [{ a: 0 }] },
      { input: '[{"a": 0, "b', output: [{ a: 0 }] },
      { input: '[{"a": 0, "b"', output: [{ a: 0 }] },
      { input: '[{"a": 0, "b":', output: [{ a: 0 }] },
      { input: '[{"a": 0, "b": 1', output: [{ a: 0, b: 1 }] },

      { input: "[{},", output: [{}] },
      { input: "[{},1", output: [{}, 1] },
      { input: '[{},"', output: [{}] },
      { input: '[{},"abc', output: [{}] },
      { input: '[{},"abc"', output: [{}, "abc"] },
    ]

    for (const test of tests) {
      const actual = JSON.stringify(
        IncompleteJson.parse(test.input, {
          prohibitPartialStrings: true,
        }),
      )
      const expected = JSON.stringify(test.output)
      expect(actual).toEqual(expected)
    }
  })

  test("prohibitPartialNumbers", () => {
    const tests = [
      { input: "", output: undefined },
      { input: '"', output: "" },

      { input: "n", output: undefined },
      { input: "nu", output: undefined },
      { input: "nul", output: undefined },
      { input: "null", output: null },

      { input: "tru", output: undefined },
      { input: "true", output: true },
      { input: "fals", output: undefined },
      { input: "false", output: false },

      { input: "0", output: undefined },
      { input: "-", output: undefined },
      { input: "1", output: undefined },
      { input: "-1", output: undefined },
      { input: "-1.", output: undefined },
      { input: "-1.3", output: undefined },
      { input: "-1.3e", output: undefined },
      { input: "-1.3e2", output: undefined },
      { input: "-1.3E", output: undefined },
      { input: "-1.3E2", output: undefined },
      { input: "-1.3E+", output: undefined },
      { input: "-1.3E+2", output: undefined },
      { input: "-1.3E-", output: undefined },
      { input: "-1.3E-2", output: undefined },

      { input: "[0,", output: [0] },
      { input: "[1,", output: [1] },
      { input: "[-1,", output: [-1] },
      { input: "[-1.3,", output: [-1.3] },
      { input: "[-1.3e2,", output: [-130] },
      { input: "[-1.3E2,", output: [-130] },
      { input: "[-1.3E+2,", output: [-130] },
      { input: "[-1.3E-2,", output: [-0.013] },

      { input: "[", output: [] },
      { input: "[0", output: [] },
      { input: "[1", output: [] },
      { input: "[12", output: [] },
      { input: "[12.", output: [] },
      { input: "[12.3", output: [] },
      { input: "[1,", output: [1] },
      { input: "[12,", output: [12] },
      { input: "[12.3,", output: [12.3] },
      { input: "[0]", output: [0] },
      { input: '["', output: [""] },
      { input: "[0,", output: [0] },

      { input: "{", output: {} },
      { input: '{"a', output: {} },
      { input: '{"a"', output: {} },
      { input: '{"a": ', output: {} },
      { input: '{"a": 0', output: {} },
      { input: '{"a": 0,', output: { a: 0 } },
      { input: '{"a": "', output: { a: "" } },
      { input: '{"a": "b', output: { a: "b" } },
      { input: '{"a": "b"', output: { a: "b" } },
      { input: '{"a": "b",', output: { a: "b" } },

      { input: "[{", output: [{}] },
      { input: '[{"', output: [{}] },
      { input: '[{"a', output: [{}] },
      { input: '[{"a"', output: [{}] },
      { input: '[{"a": ', output: [{}] },
      { input: '[{"a": 0', output: [{}] },
      { input: '[{"a": 0, ', output: [{ a: 0 }] },
      { input: '[{"a": 0, "', output: [{ a: 0 }] },
      { input: '[{"a": 0, "b', output: [{ a: 0 }] },
      { input: '[{"a": 0, "b"', output: [{ a: 0 }] },
      { input: '[{"a": 0, "b":', output: [{ a: 0 }] },
      { input: '[{"a": 0, "b": 1', output: [{ a: 0 }] },
      { input: '[{"a": 0, "b": 1,', output: [{ a: 0, b: 1 }] },

      { input: "[{},", output: [{}] },
      { input: "[{},1", output: [{}] },
      { input: "[{},1,", output: [{}, 1] },
      { input: '[{},"', output: [{}, ""] },
      { input: '[{},"abc', output: [{}, "abc"] },
    ]

    for (const testCase of tests) {
      const actual = JSON.stringify(
        IncompleteJson.parse(testCase.input, {
          prohibitPartialNumbers: true,
        }),
      )

      const expected = JSON.stringify(testCase.output)

      expect(actual).toEqual(expected)
    }
  })

  test("completeObjectSentinel", () => {
    const tests = [
      { input: "[", output: [] },
      { input: "[0", output: [0] },
      { input: "[0]", output: [0, "__array_is_done"] },
      { input: '["', output: [""] },
      { input: "[0,", output: [0] },

      { input: "{", output: {} },
      { input: '{"a', output: {} },
      { input: '{"a"', output: {} },
      { input: '{"a": ', output: {} },
      { input: '{"a": 0', output: { a: 0 } },
      { input: '{"a": 0,', output: { a: 0 } },
      { input: '{"a": "', output: { a: "" } },
      { input: '{"a": "b', output: { a: "b" } },
      { input: '{"a": "b"', output: { a: "b" } },
      { input: '{"a": "b",', output: { a: "b" } },
      { input: '{"a": "b"}', output: { a: "b", __done: true } },

      { input: "[{", output: [{}] },
      { input: "[{}", output: [{ __done: true }] },
      { input: '[{"', output: [{}] },
      { input: '[{"a', output: [{}] },
      { input: '[{"a"', output: [{}] },
      { input: '[{"a": ', output: [{}] },
      { input: '[{"a": 0', output: [{ a: 0 }] },
      { input: '[{"a": 0}', output: [{ a: 0, __done: true }] },
      { input: '[{"a": 0, ', output: [{ a: 0 }] },
      { input: '[{"a": 0, "', output: [{ a: 0 }] },
      { input: '[{"a": 0, "b', output: [{ a: 0 }] },
      { input: '[{"a": 0, "b"', output: [{ a: 0 }] },
      { input: '[{"a": 0, "b":', output: [{ a: 0 }] },
      { input: '[{"a": 0, "b": 1', output: [{ a: 0, b: 1 }] },
      { input: '[{"a": 0, "b": 1}', output: [{ a: 0, b: 1, __done: true }] },
      {
        input: '[{"a": 0, "b": 1}, {',
        output: [{ a: 0, b: 1, __done: true }, {}],
      },
      {
        input: '[{"a": 0, "b": 1}, {}',
        output: [{ a: 0, b: 1, __done: true }, { __done: true }],
      },

      { input: "[{},", output: [{ __done: true }] },
      { input: "[{},1", output: [{ __done: true }, 1] },
      { input: '[{},"', output: [{ __done: true }, ""] },
      { input: '[{},"abc', output: [{ __done: true }, "abc"] },
    ]

    for (const test of tests) {
      const parse = IncompleteJson.parse(test.input)
      const actual = JSON.stringify(parse, (k, v) => {
        if (v && v[ItemDoneStreaming]) {
          v["__done"] = true
          if (Array.isArray(v)) {
            v.push("__array_is_done")
          }
        }
        return v
      })
      const expected = JSON.stringify(test.output)
      expect(actual).toEqual(expected)
    }
  })

  test("escape sequences", () => {
    const tests = [
      { input: '"\\', output: "" },
      { input: '"\\\\', output: "\\" },
      { input: '"\\n"', output: "\n" },
      { input: '"\\"', output: '"' },
      { input: '"\\u"', output: "" },
      { input: '"\\u1"', output: "" },
      { input: '"\\u12"', output: "" },
      { input: '"\\u123"', output: "" },
      { input: '"\\u1234"', output: "ሴ" },
      { input: '"\\u1234hello"', output: "ሴhello" },
      { input: `{"key": "v\\`, output: { key: "v" } },
      { input: `{"key": "v\\n`, output: { key: "v\n" } },
    ]

    for (const testCase of tests) {
      const actual = JSON.stringify(IncompleteJson.parse(testCase.input))
      const expected = JSON.stringify(testCase.output)
      expect(actual).toEqual(expected)
    }
  })
})
