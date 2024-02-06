export class IncompleteJson {
    options;
    /**
     * Parse a prefix of a JSON serialized string into as much data as possible
     * Options available to ensure atomic string/number parsing and mark completed objects
     */
    static parse(string, options) {
        if (!string)
            return undefined;
        const parser = new IncompleteJson(options);
        parser.addChunk(string);
        if (!options?.prohibitPartialNumbers || !string.match(/(\d|\.)$/)) {
            parser.done();
        }
        return parser.readValue();
    }
    /**
     * Parse a ReadableStream<string> of JSON data into a ReadableStream<TData> of
     * as much data as can be extracted from the stream at each moment in time.
     */
    static fromReadable(readable, options) {
        const parser = new IncompleteJson(options);
        let prior;
        const transformer = new TransformStream({
            start() { },
            transform(chunk, controller) {
                parser.addChunk(chunk);
                const next = parser.readValue();
                if (next !== prior) {
                    controller.enqueue(next);
                    prior = next;
                }
            },
            flush(controller) {
                parser.done();
                const next = parser.readValue();
                if (next !== prior) {
                    controller.enqueue(next);
                    prior = next;
                }
            },
        });
        return readable.pipeThrough(transformer);
    }
    consumed = "";
    unconsumed = "";
    inString = false;
    inNumber = false;
    charsNeededToClose = "";
    context = [];
    isDone = false;
    truncationInfo = undefined;
    internalObjectStreamComplete;
    internalObjectRawLiteral = "value";
    constructor(options) {
        this.options = options;
        this.internalObjectStreamComplete =
            "__" +
                Number(String(Math.random()).slice(2)).toString(36) +
                Number(String(Math.random()).slice(2)).toString(36) +
                Number(String(Math.random()).slice(2)).toString(36);
    }
    /**
     * Add a chunk of data to the stream.
     *
     * This runs in time linear to the size of the chunk.
     */
    addChunk(chunk) {
        if (this.isDone)
            throw Error("Cannot add chunk to parser marked done");
        // called to save the current state as a "safe" spot to truncate and provide a result
        const markTruncateSpot = (delta = 0) => (this.truncationInfo = {
            index: this.consumed.length + delta,
            append: this.charsNeededToClose,
        });
        // consume everything we didn't consume last time, then the new chunk
        const toConsume = this.unconsumed + chunk;
        this.unconsumed = "";
        for (let i = 0; i < toConsume.length; i++) {
            const c = toConsume[i];
            // atomically consume escape sequences
            if (this.inString && c === "\\") {
                // we have seen the `\`
                i++;
                const escaped = toConsume[i];
                // unicode escapes are of the form \uXXXX
                if (escaped === "u") {
                    if (toConsume[i + 4] !== undefined) {
                        // if we can grab 4 chars forward, do so
                        this.consumed += c + escaped + toConsume.slice(i + 1, i + 5);
                    }
                    else {
                        // otherwise, save the rest of the string for later
                        this.unconsumed = c + escaped + toConsume.slice(i + 1, i + 5);
                    }
                    // we have seen either 4 chars or until the end of the string
                    // (if this goes over the end the loop exists normally)
                    i += 4;
                }
                else if (escaped !== undefined) {
                    // standard two char escape (\n, \t, etc.)
                    this.consumed += c + escaped;
                }
                else {
                    // end of chunk. save the \ to tack onto front of next chunk
                    this.unconsumed = c;
                }
                // restart from after the sequence
                continue;
            }
            if (!this.inString && !isNaN(+c)) {
                this.inNumber = true;
            }
            if (this.inNumber &&
                isNaN(+c) &&
                c !== "-" &&
                c !== "e" &&
                c !== "+" &&
                c !== "E" &&
                c !== ".") {
                this.inNumber = false;
            }
            // inject completed object sentinels as required
            // basically, convert:
            // `A { B `    => `A {isComplete: false, value: { B `
            // `A { B } C` => `A {isComplete: false, value: { B }, isComplete: true} C`
            // `A [ B `    => `A {isComplete: false, value: [ B `
            // `A [ B ] C` => `A {isComplete: false, value: [ B ], isComplete: true} C`
            // Flattened and replaced with the IncompleteJson.ObjectStreamComplete in this.cachedJSONParse
            if (!this.inString && c === "}") {
                this.consumed += `}, "${this.internalObjectStreamComplete}": true}`;
                this.charsNeededToClose = this.charsNeededToClose.slice(2);
                markTruncateSpot();
            }
            else if (!this.inString && c === "{") {
                this.consumed += `{"${this.internalObjectStreamComplete}": false, "${this.internalObjectRawLiteral}": {`;
                this.charsNeededToClose = "}" + this.charsNeededToClose;
            }
            else if (!this.inString && c === "[") {
                this.consumed += `{"${this.internalObjectStreamComplete}": false, "${this.internalObjectRawLiteral}": [`;
                this.charsNeededToClose = "}" + this.charsNeededToClose;
            }
            else if (!this.inString && c === "]") {
                this.consumed += `], "${this.internalObjectStreamComplete}": true}`;
                this.charsNeededToClose = this.charsNeededToClose.slice(2);
                markTruncateSpot();
            }
            else {
                //otherwise, consume the char itself
                this.consumed += c;
            }
            if (this.inString && c !== '"') {
                // if partial strings allowed, every location in a string is a potential truncate spot
                // EXCEPT in key strings - the following cannot be completed: { "ab
                if (this.context[0] !== "key" &&
                    !this.options?.prohibitPartialStrings) {
                    markTruncateSpot();
                }
                // skip over the special char handling
                continue;
            }
            // consuming a matching closing " - pop it from the stack
            if (c === this.charsNeededToClose[0] && c === '"') {
                this.charsNeededToClose = this.charsNeededToClose.slice(1);
                // good place to truncate, unless we're in a key
                if (this.context[0] !== "key") {
                    markTruncateSpot();
                }
            }
            if (this.inNumber && !this.options?.prohibitPartialNumbers) {
                // symbols found in numbers
                if (c === "e" || c === "." || c === "E") {
                    // unparsable as suffixes, trim them if partials allowed
                    markTruncateSpot(-1);
                }
            }
            if (c === '"') {
                // toggle string mode
                this.inString = !this.inString;
                // if we aren't prohibiting partial strings and we are starting a new string,
                // note how to close this string
                if (!this.options?.prohibitPartialStrings && this.inString) {
                    this.charsNeededToClose = '"' + this.charsNeededToClose;
                    if (this.context[0] !== "key") {
                        markTruncateSpot();
                    }
                }
            }
            if (c === ",") {
                // truncate right before the `,`
                markTruncateSpot(-1);
                // when parsing object, comma switches from val context to key
                if (this.context[0] === "val") {
                    this.context[0] = "key";
                }
            }
            // colon switches from key context to val
            if (c === ":") {
                if (this.context[0] === "key") {
                    this.context[0] = "val";
                }
            }
            // in array: strings can always be truncated
            if (c === "[") {
                this.context.unshift("arr");
                this.charsNeededToClose = "]" + this.charsNeededToClose;
                markTruncateSpot();
            }
            // in object: strings can be truncated in values, but not keys!
            if (c === "{") {
                this.context.unshift("key");
                this.charsNeededToClose = "}" + this.charsNeededToClose;
                markTruncateSpot();
            }
            // exiting our context, pop!
            if (c === "}" || c === "]") {
                this.context.shift();
            }
        }
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
        if (this.isDone)
            return;
        this.isDone = true;
        const rawData = this.consumed + this.charsNeededToClose;
        try {
            const result = this.cachedJSONParse(rawData);
            this.truncationInfo = {
                index: this.consumed.length,
                append: this.charsNeededToClose,
                result,
            };
        }
        catch {
            // pass: this JSON parse is expected to fail in some cases,
            // for instance when IncompleteJSON.parse is called without a complete stream.
            // the existing truncationInfo will still be good
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
    readValue() {
        if (!this.consumed || !this.truncationInfo) {
            return undefined;
        }
        if (!("result" in this.truncationInfo)) {
            try {
                this.truncationInfo.result = this.cachedJSONParse(this.consumed.slice(0, this.truncationInfo.index) +
                    this.truncationInfo.append);
            }
            catch (e) {
                console.error("ERROR: readValue called with bogus internal state.", this);
                throw e;
            }
        }
        return this.truncationInfo.result;
    }
    rawParseCache = { key: "", value: undefined };
    cachedJSONParse(str) {
        if (str !== this.rawParseCache.key) {
            this.rawParseCache = {
                key: str,
                value: JSON.parse(str, (k, v) => {
                    if (typeof v === "object" &&
                        v &&
                        this.internalObjectStreamComplete in v) {
                        const raw = v[this.internalObjectRawLiteral];
                        raw[ItemDoneStreaming] = v[this.internalObjectStreamComplete];
                        return raw;
                    }
                    return v;
                }),
            };
        }
        return this.rawParseCache.value;
    }
}
const PollyfillTextDecoderStream = () => {
    try {
        return new TextDecoderStream();
    }
    catch {
        const decoder = new TextDecoder();
        return new TransformStream({
            transform(chunk, controller) {
                const text = decoder.decode(chunk, { stream: true });
                if (text.length !== 0) {
                    controller.enqueue(text);
                }
            },
            flush(controller) {
                const text = decoder.decode();
                if (text.length !== 0) {
                    controller.enqueue(text);
                }
            },
        });
    }
};
/**
 * Given an OpenAi streaming style `Response`, convert it to either an error object
 * if request was unsuccessful, or a `ReadableStream<string>` of
 * `*.choices[0].delta.content` values for each line received
 */
export const ReadableFromOpenAIResponse = (response) => {
    if (response.status !== 200) {
        return { error: response.json() };
    }
    if (!response.body) {
        throw Error("Response is non-erroneous but has no body.");
    }
    let partial = "";
    return response.body.pipeThrough(PollyfillTextDecoderStream()).pipeThrough(new TransformStream({
        transform(value, controller) {
            const chunk = partial + value;
            partial = "";
            const lines = chunk
                .split("\n\n")
                .map((x) => x.trim())
                .filter((x) => x && x.startsWith("data: "))
                .map((x) => x.slice("data: ".length));
            for (const line of lines) {
                if (line === "[DONE]") {
                    break;
                }
                try {
                    const json = JSON.parse(line);
                    const content = json.choices[0].delta.content;
                    if (content !== undefined) {
                        controller.enqueue(content);
                    }
                }
                catch {
                    // data line incomplete?
                    partial += "data: " + line;
                }
            }
        },
    }));
};
/**
 * Convert an `ReadableStream` to a `AsyncIterable` for use in `for await (... of ... ) { ... }` loops
 *
 * By the spec, a `ReadableStream` is already `AsyncIterable`, but most browsers to not support this (server-side support is better).
 *
 * See https://github.com/microsoft/TypeScript/issues/29867, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of
 */
export async function* AsAsyncIterable(readable) {
    const reader = readable.getReader();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                return;
            yield value;
        }
    }
    finally {
        reader.releaseLock();
    }
}
/**
 * Symbolic sentinel added to objects/arrays when the stream has completed defining the value.
 *
 * This will be present as a symbolic key with value `true` on all objects/arrays that
 * have finished streaming, and will be missing otherwise.
 *
 * Ex:
 * ```ts
 * const values = IncompleteJson.parse<{ value: string }[]>(
 *   '[{"value": "a"}, {"value": "ab',
 * )
 *
 * values?.[ItemDoneStreaming]      // false
 * values?.[0]?.[ItemDoneStreaming] // true
 * values?.[1]?.[ItemDoneStreaming] // false
 * ```
 */
export const ItemDoneStreaming = Symbol("gjp-4-gpt.ItemDoneStreaming");
