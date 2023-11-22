# GJP-4-GPT
## Gradual JSON Parser for Generative Pretrained Transformers

A package for consuming the outputs of JSON-producing LLM's live as they are delivered. Supports both a streaming mode and a `JSON.parse` drop in replacement that handles parsing as much data as possible from a not-yet-completed JSON string.

See it live at https://rexipie.com and in the [LLM Book](https://marketplace.visualstudio.com/items?itemName=jaaxxx.llm-book) VS Code extension.

## Use

### Install

```bash
npm install gjp-4-gpt
bun install gjp-4-gpt
yarn add gjp-4-gpt
```

### Basic Parsing

The `IncompleteJSON.parse` takes a string prefix of a valid JSON string and parses as much data out of it as possible, with options provided to prohibit incomplete parsing of literals (strings, numbers). Objects and arrays that have been fully defined by the prefix (those with matching closing braces/brackets) are identified by the presence of the `gjp-4-gpt.ItemDoneStreaming` symbolic key being set to `true` on them.

This entry point is best suited for basic testing or when your JSON stream has already been concatenated elsewhere and it would be unfeasible to supply a `ReadableStream`. In cases where a `ReadableStream` is available, the `IncompleteJSON.fromReadable` entry should be preferred.

```ts
import { IncompleteJSON, ItemDoneStreaming } from 'gjp-4-gpt'

IncompleteJSON.parse(`"It was a bright cold day in April, `)
> "It was a bright cold day in April, "

IncompleteJSON.parse(`["this data", ["is miss`)
> ["this data", ["is miss"]]

IncompleteJSON.parse<Record<string, string>>(`{"key1": "myValue", "key`)
> {key1: "myValue"}

IncompleteJSON.parse(`["foo", "bar", "ba`, {prohibitPartialStrings: true})
> ["foo", "bar"]


// type of values is Incomplete<{value: string}[]>
const values = IncompleteJson.parse<{ value: string }[]>(
  `[{"value": "a"}, {"value": "ab`,
)

values?.[ItemDoneStreaming] // false
values?.[0]?.[ItemDoneStreaming] // true
values?.[1]?.[ItemDoneStreaming] // false

// types are coerced accordingly
if (values?.[0]?.[ItemDoneStreaming]) {
  values[0].value // string
} else {
  values?.[0]?.value // string | undefined
}

if (values?.[ItemDoneStreaming]) {
  // `values` and all children are coerced into their `Complete<T>` counterparts
  values[1] // { value: string }
} else {
  values?.[1] // { value?: string } | undefined
}
```

> More detail on the `Incomplete<T>`/`Complete<T>` higher-ordered-types is provided below.

### Stream Parsing

This is likely to be the main entry point used by application code. 
The `IncompleteJSON.fromReadable` method takes a `ReadableStream<string>` and the same options as above,
and converts it to a `ReadableStream<Incomplete<T>>`, where `T` is the type of object you are expecting the stream to generate. For convenience, utilities for parsing OpenAI-style responses and working with `ReadableStream`'s in contexts without full `AsyncIterable` spec implementation are provided.

The `options` object, `ItemDoneStreaming` sentinels, and `Incomplete<T>` result object are the same as in the plain `parse` method.

```ts
import { IncompleteJSON, ReadableFromOpenAIResponse } from 'gjp-4-gpt'

const response = await fetch(openAIStyleEndpoint, {
  ...
  body: JSON.stringify({
    stream: true,
    ...
  })
})

const plaintextReadable = ReadableFromOpenAIResponse(response)

if (plaintextReadable.error) {
  // Handle status >=400 errors: bad auth, invalid options, request too long, etc.
  const details = await plaintextReadable.error
}
else {
  const objectReadable = IncompleteJSON.fromReadable<T>(plaintextReadable, options)

  // Server-side and Firefox:
  for await (const partial of objectReadable) {
    // do something with the `partial: Incomplete<T>`...
  }
  
  // Everywhere else:
  for await (const chunk of AsAsyncIterable(objectReadable)) {
    // do something with the `partial: Incomplete<T>`...
  }
}
```

> See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of and https://github.com/microsoft/TypeScript/issues/29867 for more info on working with `ReadableStreams`'s and `AsyncIterable`'s.

### `Incomplete<T>`, `Complete<T>`, `Symbol("gjp-4-gpt.ItemDoneStreaming")`, oh my!

Streaming data is great, but there are times when it is helpful to know you've received all the data before allowing a particular operation. `Incomplete`, `Complete`, and `ItemDoneStreaming` to the rescue!

All value objects returned by `IncompleteJSON` methods are of the `Incomplete<T>` type. 
This is similar to a deep `Partial<T>`, with the notable exception that array elements
are not made `| undefined` (unless `T` explicitly declares them as such).

Furthermore,
every object and array will has the `[ItemDoneStreaming]: boolean` symbolic key tacked on.
TypeScript will identify checks for this value, and in codepaths following a successful check 
the value and all its children (`value`, `value.whatever`, `value[3].foo.bar[4]`, etc.) are
coerced from the `Incomplete<T>` *back* to `T` (or actually `Complete<T>`, which is 
the same as `T` but maintaining the ability to access `[ItemDoneStreaming]`, which will always be `true`).

```ts
import { ItemDoneStreaming } from 'gjp-4-gpt'

function doThingWithCompleteDataItem(item: T) { ... }

function processOnlyFullyCompletedItems(data: Incomplete<T[]>) {
  if (!data) {
    // no bytes received yet...
    return
  } else {
    for (const entry of data) {
      // entry is Exclude<Incomplete<T>, undefined>
      if (entry[ItemDoneStreaming]) {
        // entry is Complete<T>, which is assignable to T
        doThingWithCompleteDataItem(entry)
      } else {
        // entry is not undefined, but no further data is known yet...
        // entry.whatever could be checked for `[ItemDoneStreaming]` if needed
      }
    }
  }
}
```



## Development

To install dependencies:

```bash
bun install
```

To test:

```bash
bun test
```

To lint:
```bash
npx eslint .
```

The `rand` directory contains various additional scripts and sample data used for
performance testing and experimentation.

## Next Steps

### Features

Some features that might be worth adding in the future:

- **JSONC**: Allowing for train of thought prefixes can improve a GPT's ability to produce correct results. Currently a JSON field can be devoted to response prefixing, but putting that into a comment could make sense. Also trailing commas :).
- **JSONL**: A relatively simple `TransformStream` can convert a JSONL input into a plain JSON array suitable for this library (prefix with a `[` and replace `\n`'s with `,`'s), but including it here might make sense.
- **prose-embedded JSON**: GPT's may return a response that embeds a JSON string inside other prose (Example: "Sure, I can do that for you, here's the data:\n```json ..."). A way to detect and parse that might make sense.
- **Multiple Readers**: It may be useful in some circumstances to combine multiple JSON streams into a single object, for instance to increase throughput or to use different models for different fields. Supporting this might make sense.

Happy to take additional suggestions in the Feature Requests, or +1's to any of the above if interested!

### Performance

The performance is currently suitable for the outputs of LLM's (which are typically length constrained), 
but the goal of this project so far has been to prioritize exploration and ease of use over speed. For reference, a 64KB json string parses in ~0.1ms using the native `JSON.parse`, 6ms using `IncompleteJSON.parse`, and 2ms with a hand written vanilla JS parser.

A future rewrite may develop a gradual JSON parser from scratch rather than the current approach of patching the truncated JSON
and feeding it into the builtin `JSON.parse` method, which should increase the speed enough to be suitable for most applications.

For reference, my testing has a 5MB json string parse in 10ms using the native `JSON.parse`, compared to 300ms using `IncompleteJSON.parse`. A simplistic hand written JSON parser takes ~60ms for the same input, which is around the lower bound for how fast a JavaScript rewrite of this functionality could possibly be.
