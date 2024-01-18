export type IncompleteJsonOptions = {
    /**
     * When enabled, strings will only be emitted when their full value has been read.
     */
    prohibitPartialStrings?: boolean;
    /**
     * When enabled, numbers will only be emitted when their full value has been read.
     *
     * *Note*: In plain parse mode, if the JSON consists of only a single numeric value and this option is enabled,
     * the value will *never* be emitted, as it is impossible to tell whether the number is complete.
     * This is not the case in ReadableStream mode, as the ending is explicitly signaled.
     */
    prohibitPartialNumbers?: boolean;
};
export declare class IncompleteJson<T> {
    private options?;
    /**
     * Parse a prefix of a JSON serialized string into as much data as possible
     * Options available to ensure atomic string/number parsing and mark completed objects
     */
    static parse<T>(string: string, options?: IncompleteJsonOptions): Incomplete<T>;
    /**
     * Parse a ReadableStream<string> of JSON data into a ReadableStream<TData> of
     * as much data as can be extracted from the stream at each moment in time.
     */
    static fromReadable<T>(readable: ReadableStream<string>, options?: IncompleteJsonOptions): ReadableStream<Incomplete<T>>;
    private consumed;
    private unconsumed;
    private inString;
    private inNumber;
    private charsNeededToClose;
    private context;
    private isDone;
    private truncationInfo;
    private internalObjectStreamComplete;
    private internalObjectRawLiteral;
    constructor(options?: IncompleteJsonOptions | undefined);
    /**
     * Add a chunk of data to the stream.
     *
     * This runs in time linear to the size of the chunk.
     */
    addChunk(chunk: string): void;
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
    done(): void;
    /**
     * Attempt to parse the consumed chunks into as much data as is available
     *
     * This operation runs in time linear to the length of the stream
     *
     * While modern JSON parsers are significantly faster than modern LLM's, care
     * should be taken on very large inputs to not call readValue more then needed
     */
    readValue(): Incomplete<T>;
    private rawParseCache;
    private cachedJSONParse;
}
/**
 * Given an OpenAi streaming style `Response`, convert it to either an error object
 * if request was unsuccessful, or a `ReadableStream<string>` of
 * `*.choices[0].delta.content` values for each line received
 */
export declare const ReadableFromOpenAIResponse: (response: Response) => (ReadableStream<string> & {
    error?: never;
}) | {
    error: Promise<{
        error: {
            message: string;
            type: string;
            code: string;
        };
    }>;
};
/**
 * Convert an `ReadableStream` to a `AsyncIterable` for use in `for await (... of ... ) { ... }` loops
 *
 * By the spec, a `ReadableStream` is already `AsyncIterable`, but most browsers to not support this (server-side support is better).
 *
 * See https://github.com/microsoft/TypeScript/issues/29867, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of
 */
export declare function AsAsyncIterable<T>(readable: ReadableStream<T>): AsyncIterable<T>;
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
export declare const ItemDoneStreaming: unique symbol;
/**
 * Deep partial of `T`
 *
 * When `S` is defined, reading `[S]: true` from an object anywhere in the tree
 * coerces it and all its children back into a non-partial (`Complete<>`) mode.
 */
export type Incomplete<T> = (T extends (infer V)[] ? Complete<V[]> | ({
    [ItemDoneStreaming]?: never;
} & Exclude<Incomplete<V>, undefined>[]) : T extends object ? Complete<T> | ({
    [ItemDoneStreaming]?: never;
} & {
    [P in keyof T]?: Incomplete<T[P]>;
}) : T) | undefined;
/**
 * Deeply adds the entry `[S]: true` to every object in `T`
 */
export type Complete<T> = T extends (infer V)[] ? {
    [ItemDoneStreaming]: true;
} & Complete<V>[] : T extends object ? {
    [ItemDoneStreaming]: true;
} & {
    [P in keyof T]: Complete<T[P]>;
} : T;
