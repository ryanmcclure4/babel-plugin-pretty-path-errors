# babel-plugin-pretty-path-errors

> A plugin to wrap all function bodies in try/catch blocks and bubble up errors with a path derived from function names, providing a more effective way of locating the source of error

## Why?
In many cases you will have deeply nested function calls which will inevitably throw errors at some point or another. Transpiled code will frequently change the line number, character position, and function names within the stack traces of errors. This requres you to sift through the transpiled code in order to find the actual location of the error.

Wouldn't life be easier if you just knew which function was called? And which function called that function? Today is your lucky day! This plugin wraps all functions in try/catch blocks, bubbling up errors and supplying them with a path built from the function names, which you can then use to instantly locate the source of error.

As an added bonus, the added try/catch prevents errors thrown in async/await from getting swallowed. This allows you to write your functions without having to worry about always manually surrounding async blocks in a try/catch.

## Installation

`npm install --save-dev babel-plugin-pretty-path-error`

## Usage
### Via .babelrc
```
{
  "plugins": ["babel-plugin-pretty-path-errors"]
}
```

### Via CLI
```
babel --plugins babel-plugin-pretty-path-errors script.js
```

## Disclaimer
While this plugin adds the _functionPath_ property to errors, it won't be useful if you still don't catch the error at the top level of your program. The _toString_ function of a custom Error seems to be overridden by the default Error.prototype.toString when errors are thrown in node. Thus, I suggest making sure your top level code has an error catching mechanism (...which you should probably be doing regardless :) )

```
try {
  (function foo() { ... })();
} catch (err) {
  // err.toString()
}
```

## Examples

### Deeply nested function calls
```
(function a() {
  (function b() {
    (function c() {
      (function d() {
        (function e() {
          throw new Error('Where am I?');
        })();
      })();
    })();
  })();
})();
```
The error thrown by the above code would contain a property _functionPath_ with a value:
```
'a->b->c->d->e'
```

### Basic use case
```
function foo() {
  throw new Error('Where was I thrown?');
}

function bar() {
  foo();
}

try {
  bar();
} catch(err) {
  console.log(err.message); // 'Where was I thrown?'
  console.log(err.functionPath); // 'foo->bar'

  // Use the toString method to get the full error with function path
  // err.toString() -> 'Where was I thrown? | Location(foo->bar)'
}
```

### Async / Await
```
async function foo() {
  throw new Error('Where was I thrown?');
}

async function bar() {
  await foo();
}

try {
  bar();
} catch(err) {
  // err.toString() -> 'Where was I thrown? | Location(foo->bar)'
}
```

## Custom catch block
If you want to run a block of code after an error is thrown in your function, add it at the bottom of the function body preceeded by a comment with _@onError_

```
var success = 1;

function bar() {
  foo();

  // @onError
  success = 0;
}

try {
  bar();
} catch {
  console.log(success); // 0
}
```

## Existing try/catch
If you have an existing try/catch block in your code, error handling will be added to the end of the catch block

## Options
The default delimiter used to build the function path is an arrow `->`, however you may specify a custom delimiter if desired:

```
// .babelrc

{
  plugins: [
    ["pretty-path-errors", { "delimiter": "." }]
  ]
}
```
The above would provide you with a function path `a.b.c` rather than `a->b->c`

