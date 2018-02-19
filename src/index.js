var babylon = require('babylon');


/**
 * Generates a catch block given a function name
 */
var getCatchBlock = function (delimiter, functionName, handlerName = 'err') {
  return `
    var Err = require('babel-plugin-pretty-path-errors/src/Err.js');
    var path = '${functionName}';

    if (${handlerName}.name === 'PrettyPathError') {
      path = path + '${delimiter}' + ${handlerName}.functionPath;
    }

    throw new Err(${handlerName}, path);
  `;
};

/**
 * Wraps node body in try/catch if this function doesn't have one
 */
var insertTryStatement = function ({ delimiter, path, body, name, t }) {
  var catchBlockIndex = -1;
  
  // If @onError exists in main block, move code to catch block
  if (body) {
    catchBlockIndex = body.findIndex(function(body, index) {
      if (
        body.leadingComments &&
        body.leadingComments.length &&
        body.leadingComments[0].value.match(/@onError/g)
      ) {
        return true;
      }
      return false;
    });
  }

  var tryBody = path.node.body;
  var catchBody = [];

  // Separate custom catch body from try body
  if (catchBlockIndex > -1) {
    tryBody.body = body.slice(0, catchBlockIndex);
    catchBody = body.slice(catchBlockIndex);

    // Remove @onError leading comment from catch body
    delete catchBody[0].leadingComments;

    // Remove trailing comments from preceeding block
    if (catchBlockIndex > 0) {
      delete tryBody.body[catchBlockIndex - 1].trailingComments;
    }
  }

  catchBody = catchBody.concat(
    babylon.parse(getCatchBlock(delimiter, name)).program.body
  );

  path.node.body = t.blockStatement([
    t.tryStatement(
      tryBody,
      t.catchClause(
        t.identifier('err'),
        t.blockStatement(
          catchBody
        )
      )
    )
  ]);
};

/**
 * Adds error handling if try/catch exists in function
 */
var modifyTryStatement = function ({ delimiter, path, body, name, existingTryStatement, t }) {
  const handlerBody = existingTryStatement.handler.body.body;
  const handlerName = existingTryStatement.handler.param.name;
  const catchBody = handlerBody.concat(
    babylon.parse(getCatchBlock(delimiter, name, handlerName)).program.body
  );

  existingTryStatement.handler.body = t.blockStatement(catchBody);
};

/**
 * Visitor
 */
module.exports = function ({ types: t }) {
  return {
    visitor: {

      /**
       * Add Program visitor to traverse first, avoiding possibility of
       * function names being changed by other plugins
       */
      Program(programPath, state) {
        // Function name delimiter
        var delimiter = state.opts.delimiter || ' -> ';

        programPath.traverse({
          Function: function (path) {
            // Ignore if not a function or it is anonymous
            if (
              ![
                'ClassMethod',
                'ObjectMethod',
                'FunctionDeclaration',
                'FunctionExpression',
              ].includes(path.node.type) ||
              (!path.node.id && !path.node.key)
            ) return;

            var name;
            var body;

            if (path.node.id) name = path.node.id.name;
            if (path.node.key) name = path.node.key.name;

            // If this is a class method, prepend the class name
            if (path.node.type === 'ClassMethod') {
              name = path.parentPath.container.id.name + delimiter + name;
            }

            // IF this is an assignment expression, prepened the parent object name
            if (path.parentPath.node.type === 'AssignmentExpression') {
              name = path.parentPath.node.left.object.name + delimiter + name;
            }

            if (path.node.body && path.node.body.body) {
              body = path.node.body.body;
            }

            // Ignore if try statement already exists
            var existingTryStatement = body.find(function(body) {
              return t.isTryStatement(body);
            });

            var args =  { delimiter, path, name, body, existingTryStatement, t };

            if (existingTryStatement) {
              modifyTryStatement(args);
            } else {
              insertTryStatement(args);
            }
          }
        });
      },
    }
  }
};
