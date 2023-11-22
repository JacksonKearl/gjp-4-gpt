import { ItemDoneStreaming, IncompleteJsonOptions } from "../index.ts"
import { expect } from "bun:test"

// https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Objects/JSON
export const e1 = {
  squadName: "Super hero squad",
  homeTown: "Metro City",
  formed: 2016,
  secretBase: "Super tower",
  active: true,
  members: [
    {
      name: "Molecule Man",
      age: 29,
      secretIdentity: "Dan Jukes",
      powers: ["Radiation resistance", "Turning tiny", "Radiation blast"],
    },
    {
      name: "Madame Uppercut",
      age: 39,
      secretIdentity: "Jane Wilson",
      powers: [
        "Million tonne punch",
        "Damage resistance",
        "Superhuman reflexes",
      ],
      isAdmin: true,
    },
    {
      name: "Eternal Flame",
      age: 1000000,
      secretIdentity: "Unknown",
      powers: [
        "Immortality",
        "Heat Immunity",
        "Inferno",
        "Teleportation",
        "Interdimensional travel",
      ],
    },
  ],
}

export const e2 = [
  {
    name: "Molecule Man",
    age: 29,
    secretIdentity: "Dan Jukes",
    powers: ["Radiation resistance", "Turning tiny", "Radiation blast"],
  },
  {
    name: "Madame Uppercut",
    age: 39,
    secretIdentity: "Jane Wilson",
    powers: ["Million tonne punch", "Damage resistance", "Superhuman reflexes"],
  },
]

export const verifyIsValidPartial = (
  partialValue: any,
  fullValue: any,
  options: IncompleteJsonOptions,
) => {
  const partialValuePaths = getPathsForJSONValue(partialValue)

  for (const partialValuePath of partialValuePaths) {
    const partialValueAtPath = getValueAtPath(partialValue, partialValuePath)
    const fullValueAtPath = getValueAtPath(fullValue, partialValuePath)

    try {
      expect(fullValueAtPath).toBeDefined()
      expect(partialValueAtPath).toBeDefined()

      if (typeof fullValueAtPath === "string") {
        if (options.prohibitPartialStrings) {
          expect(partialValueAtPath).toEqual(fullValueAtPath)
        } else {
          expect(partialValueAtPath).toBeString()
          expect(fullValueAtPath).toStartWith(partialValueAtPath as string)
        }
      } else if (typeof fullValueAtPath === "number") {
        if (options.prohibitPartialNumbers) {
          expect(partialValueAtPath).toEqual(fullValueAtPath)
        } else {
          expect(partialValueAtPath).toBeNumber()
          expect(String(fullValueAtPath)).toStartWith(
            String(partialValueAtPath),
          )
        }
      } else if (typeof fullValueAtPath === "boolean") {
        expect(partialValueAtPath).toEqual(fullValueAtPath)
      } else if (fullValueAtPath === null) {
        expect(partialValueAtPath).toBeNull()
      } else if (Array.isArray(fullValueAtPath)) {
        expect(partialValueAtPath).toBeArray()
        if ((partialValueAtPath as any)[ItemDoneStreaming]) {
          expect(JSON.stringify(partialValueAtPath)).toEqual(
            JSON.stringify(fullValueAtPath),
          )
        }
      } else {
        expect(typeof partialValueAtPath).toBe("object")
        expect(typeof fullValueAtPath).toBe("object")
        if ((partialValueAtPath as any)[ItemDoneStreaming]) {
          expect(JSON.stringify(partialValueAtPath)).toEqual(
            JSON.stringify(fullValueAtPath),
          )
        }
      }
    } catch (e) {
      console.log({
        error: e,
        partialValuePath,
        partialValueAtPath,
        fullValueAtPath,
        partialValue,
        fullValue,
        options,
      })
      throw e
    }
  }
}

export type JSONValue =
  | true
  | false
  | null
  | string
  | number
  | { [key: string]: JSONValue }
  | JSONValue[]

const getPathsForJSONValue = (value: JSONValue): string[][] => {
  if (value === undefined)
    throw Error("attempting to get paths for undefined value")

  const paths: string[][] = []
  paths.push([])

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([k, v]) => {
      for (const path of getPathsForJSONValue(v)) {
        paths.push([k, ...path])
      }
    })
  }
  return paths
}

const getValueAtPath = (
  value: JSONValue,
  path: string[],
): JSONValue | undefined => {
  if (path.length === 0 || value === undefined) return value

  const [head, ...tail] = path
  return getValueAtPath((value as any)?.[head], tail)
}
