import { IncompleteJson, ReadableFromOpenAIResponse } from "../index.ts"

const run = async () => {
  const messages = [
    {
      content:
        "You are a serialized data emitter that always responds to the users request in proper JSON.",
      role: "system",
    },
    {
      content:
        "Please give a big example data object with lots of objects, fields, arrays, booleans, strings, numbers, escape sequences, and nulls to stress test my JSON parser! Try to use obsure JSON features like unicode escape sequences and exponential number formats to really throw a wrench in the parser! Respond only with the JSON, do not add any comments.",
      role: "user",
    },
  ]

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + process.env.OPEN_AI_KEY,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      stream: true,
      messages,
    }),
  })
  const plaintext = ReadableFromOpenAIResponse(response)
  if (plaintext.error) {
    console.log("Error!", await plaintext.error)
  } else {
    const parsed = IncompleteJson.fromReadable<any>(plaintext)
    for await (const b of parsed) {
      console.log(b)
    }
  }
}

run()
