/**
 * Deep partial of `T`
 *
 * When `S` is defined, reading `[S]: true` from an object anywhere in the tree
 * coerces it and all its children back into a non-partial (`Complete<>`) mode.
 */
export type Incomplete<T, S extends string | undefined> =
  | (T extends (infer V)[]
      ? Exclude<Incomplete<V, S>, undefined>[]
      : T extends object
      ? S extends string
        ?
            | Complete<T, S>
            | ({ [K in S]?: never } & {
                [P in keyof T]?: Incomplete<T[P], S>
              })
        : {
            [P in keyof T]?: Incomplete<T[P], S>
          }
      : T)
  | undefined

/**
 * Deeply adds the entry `[S]: true` to every object in `T`
 */
export type Complete<T, S extends string> = T extends (infer V)[]
  ? Complete<V, S>[]
  : T extends object
  ? { [K in S]: true } & {
      [P in keyof T]: Complete<T[P], S>
    }
  : T

type IncompleteJsonOptions = {
  /**
   * When enabled, strings will only be emitted when their full value has been read.
   */
  prohibitPartialStrings?: boolean

  /**
   * When enabled, numbers will only be emitted when their full value has been read.
   *
   * *Note*: If the JSON consists of only a single numeric value and this option is enabled,
   * the value will *never* be emitted, as it is impossible to tell whether the number is complete.
   */
  prohibitPartialNumbers?: boolean

  /**
   * Optional property to be added at the end of each object to signify it has been fully streamed.
   * This will be set `true` for complete objects and will be undefined otherwise.
   *
   * Example:
   * ```ts
   * > IncompleteJson.parse('[{"foo": "bar"}, {"foo": "b',
   *                        { completeObjectSentinel: '__done' })
   * // [{foo: "bar", __done: true}, {foo: "b"}]
   * ```
   */
  completeObjectSentinel?: string
}

export class IncompleteJson<T, S extends string | undefined> {
  /**
   * Parse a prefix of a JSON serialized string into as much data as possible
   * Options available to ensure atomic string/number parsing and mark completed objects
   */
  static parse<
    T,
    O extends IncompleteJsonOptions,
    S extends string | undefined = O["completeObjectSentinel"],
  >(string: string, options?: O): Incomplete<T, S> {
    if (!string) return undefined

    const parser = new IncompleteJson<T, S>(options)
    parser.addChunk(string)
    if (!options?.prohibitPartialNumbers || !string.match(/(\d|\.)$/)) {
      parser.done()
    }

    return parser.readValue()
  }

  /**
   * Parse a ReadableStream<string> of JSON data into a ReadableStream<TData> of
   * as much data as can be extracted from the stream at each moment in time.
   */
  static fromReadable<
    T,
    O extends IncompleteJsonOptions,
    S extends string | undefined = O["completeObjectSentinel"],
  >(
    readable: ReadableStream<string>,
    options?: IncompleteJsonOptions,
  ): ReadableStream<Incomplete<T, S>> {
    const parser = new IncompleteJson<T, S>(options)
    let prior: Incomplete<T, S>

    const transformer = new TransformStream<string, Incomplete<T, S>>({
      start() {},
      transform(chunk, controller) {
        parser.addChunk(chunk)
        const next = parser.readValue()
        if (next !== prior) {
          controller.enqueue(next)
          prior = next
        }
      },
      flush(controller) {
        parser.done()
        const next = parser.readValue()
        if (next !== prior) {
          controller.enqueue(next)
          prior = next
        }
      },
    })
    return readable.pipeThrough(transformer)
  }

  // private consumed = ""
  private consumedNoAlloc = ""
  private unconsumed = ""
  private inString = false
  private charsNeededToClose: string[] = []
  private context: ("key" | "val" | "arr")[] = []

  private isDone = false

  private truncationInfo:
    | { index: number; append: string; result?: Incomplete<T, S> }
    | undefined = undefined

  constructor(private options?: IncompleteJsonOptions) {}

  /**
   * Add a chunk of data to the stream.
   *
   * This runs in time linear to the size of the chunk.
   */
  addChunk(chunk: string) {
    if (this.isDone) throw Error("Cannot add chunk to parser marked done")

    // called to save the current state as a "safe" spot to truncate and provide a result
    const markTruncateSpot = (delta: number) =>
      (this.truncationInfo = {
        index: this.consumedNoAlloc.length + delta + 1,
        append: this.charsNeededToClose.join(""),
      })

    // consume everything we didn't consume last time, then the new chunk
    const toConsume = this.unconsumed + chunk

    this.unconsumed = ""

    for (let i = 0; i < toConsume.length; i++) {
      const c = toConsume[i]

      // atomically consume escape sequences
      if (this.inString && c === "\\") {
        // we have seen the `\`
        i++
        const escaped = toConsume[i]
        // unicode escapes are of the form \uXXXX
        if (escaped === "u") {
          // we have seen the `u`
          i++
          if (toConsume[i + 3] !== undefined) {
            // if we can grab 4 chars forward, do so
            // this.consumed += c + escaped + toConsume.slice(i, i + 4)
          } else {
            // otherwise, save the rest of the string for later
            this.unconsumed = c + escaped + toConsume.slice(i, i + 4)
          }
          // we have seen either 4 chars or until the end of the string
          // (if this goes over the end the loop exists normally)
          i += 4
        } else if (escaped !== undefined) {
          // standard two char escape (\n, \t, etc.)
          // this.consumed += c + escaped
        } else {
          // end of chunk. save the \ to tack onto front of next chunk
          this.unconsumed = c
        }

        // restart from after the sequence
        continue
      }

      // inject completed object sentinels as required
      // if (!this.inString && this.options?.completeObjectSentinel && c === "}") {
      //   if (!this.consumed.trim().endsWith("{")) {
      //     this.consumed += ","
      //   }
      //   this.consumed += `"${this.options.completeObjectSentinel}": true`
      // }

      // consume the char itself
      // this.consumed += c

      // when in string...
      if (this.inString && c !== '"') {
        // if partial strings allowed, every location in a string is a potential truncate spot
        // EXCEPT in key strings - the following cannot be completed: { "ab
        if (
          this.context[0] !== "key" &&
          !this.options?.prohibitPartialStrings
        ) {
          markTruncateSpot(i)
        }

        // skip over the special char handling
        continue
      }

      // consuming a matching closing char - pop it from the stack
      if (c === this.charsNeededToClose[0]) {
        this.charsNeededToClose.shift()

        // good place to truncate, unless we're in a key
        if (this.context[0] !== "key") {
          markTruncateSpot(i)
        }
      }

      if (!this.inString && !this.options?.prohibitPartialNumbers) {
        // symbols found in numbers
        if (c === "e" || c === "." || c === "E") {
          // unparsable as suffixes, trim them if partials allowed
          markTruncateSpot(i - 1)
        }
      }

      if (c === '"') {
        // if we aren't prohibiting partial strings and we are starting a new string,
        // note how to close this string
        if (!this.options?.prohibitPartialStrings && !this.inString) {
          this.charsNeededToClose.unshift('"')
        }

        // toggle string mode
        this.inString = !this.inString
      }

      if (c === ",") {
        // truncate right before the `,`
        markTruncateSpot(i - 1)

        // when parsing object, comma switches from val context to key
        if (this.context[0] === "val") {
          this.context[0] = "key"
        }
      }

      // colon switches from key context to val
      if (c === ":") {
        if (this.context[0] === "key") {
          this.context[0] = "val"
        }
      }

      // in array: strings can always be truncated
      if (c === "[") {
        this.context.unshift("arr")
        this.charsNeededToClose.unshift("]") // + this.charsNeededToClose
        markTruncateSpot(i)
      }

      // in object: strings can be truncated in values, but not keys!
      if (c === "{") {
        this.context.unshift("key")
        this.charsNeededToClose.unshift("}") // + this.charsNeededToClose
        markTruncateSpot(i)
      }

      // exiting our context, pop!
      if (c === "}" || c === "]") {
        this.context.shift()
      }
    }

    this.consumedNoAlloc += chunk.slice(
      0,
      chunk.length - this.unconsumed.length,
    )
  }

  /**
   * Mark the stream complete.
   * This will force emit values that were not emitted previously due to potentially being incomplete.
   *
   * Example: a chunk that ends in a number will not be emitted because the next chunk may continue with a number,
   * which would be appended to the existing value (significantly changing the meaning of the represented data)
   * ```ts
   * > const ij = new IncompleteJSON<number>()
   * > ij.addChunk('1234')
   * > ij.readValue()
   * undefined
   * > ij.addChunk('5')
   * > ij.readValue()
   * undefined
   * > ij.done()
   * > ij.readValue()
   * 12345
   * ```
   */
  done() {
    if (this.isDone) return
    this.isDone = true

    const rawData = this.consumedNoAlloc + this.charsNeededToClose.join("")
    try {
      const result = this.cachedJSONParse(rawData)
      this.truncationInfo = {
        index: this.consumedNoAlloc.length,
        append: this.charsNeededToClose.join(""),
        result,
      }
    } catch {
      // pass: the JSON parse is expected to fail in some cases.
      // the prior truncationInfo will still be good.
    }
  }

  /**
   * Attempt to parse the consumed chunks into as much data as is available
   *
   * This operation runs in time linear to the length of the stream
   *
   * While modern JSON parsers are significantly faster than modern LLM's, care
   * should be taken on very large inputs to not call readValue more then needed
   */
  readValue(): Incomplete<T, S> {
    if (!this.consumedNoAlloc || !this.truncationInfo) {
      return undefined
    }

    if (!("result" in this.truncationInfo)) {
      this.truncationInfo.result = this.cachedJSONParse(
        this.consumedNoAlloc.slice(0, this.truncationInfo.index) +
          this.truncationInfo.append,
      )
    }

    return this.truncationInfo.result
  }

  private rawParseCache = { key: "", value: undefined as Incomplete<T, S> }
  private cachedJSONParse(str: string): Incomplete<T, S> {
    if (str !== this.rawParseCache.key) {
      this.rawParseCache = {
        key: str,
        value: JSON.parse(str, (k, v) => v),
      }
    }
    return this.rawParseCache.value
  }
}
