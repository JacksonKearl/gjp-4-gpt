/**
 * Parse json in vanilla JS (<es5, so to speak)
 * This is incomplete, missing scientific notation, among other things, 
 * but provides a reference for the kind of speed a hand written parser could get.
 */

export function parseJSON(jsonString) {
  let index = 0;

  function parseWhitespace() {
    const char = jsonString[index]
    if (/\s/.test(char)) {index++; parseWhitespace()}
  }

  function parseValue() {
    parseWhitespace()
    const char = jsonString[index];

    if (char === '{') {
      return parseObject();
    } else if (char === '[') {
      return parseArray();
    } else if (char === '"') {
      return parseString();
    } else if (char === 't' && jsonString.slice(index, index + 4) === 'true') {
      index += 4;
      return true;
    } else if (char === 'f' && jsonString.slice(index, index + 5) === 'false') {
      index += 5;
      return false;
    } else if (char === 'n' && jsonString.slice(index, index + 4) === 'null') {
      index += 4;
      return null;
    } else {
      return parseNumber();
    }
  }

  function parseObject() {
    let obj = {};

    // Skip the opening brace
    index++;

    while (jsonString[index] !== '}') {
      parseWhitespace()
      const key = parseString();
      parseWhitespace()
      // Skip the colon
      index++;
      parseWhitespace()
      const value = parseValue();
      obj[key] = value;
      parseWhitespace()
      // Skip comma or closing brace
      index += (jsonString[index] === ',') ? 1 : 0;
    }

    // Skip the closing brace
    index++;
    parseWhitespace()

    return obj;
  }

  function parseArray() {
    let arr = [];

    // Skip the opening bracket
    index++;

    while (jsonString[index] !== ']') {
      const value = parseValue();
      arr.push(value);
      parseWhitespace()
      // Skip comma or closing bracket
      index += (jsonString[index] === ',') ? 1 : 0;
    }

    // Skip the closing bracket
    index++;

    return arr;
  }

  function parseString() {
    // Skip the opening quote
    parseWhitespace()
    index++;
    let result = '';

    while (jsonString[index] !== '"') {
      result += jsonString[index];
      index++;
    }

    // Skip the closing quote
    index++;
    parseWhitespace()

    return result;
  }

  function parseNumber() {
    parseWhitespace()
    let numStr = '';

    while (/[\d.+-]/.test(jsonString[index])) {
      numStr += jsonString[index];
      index++;
    }
    parseWhitespace()
    return isNaN(numStr) ? undefined : parseFloat(numStr);
  }

  return parseValue();
}