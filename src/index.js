var babylon = require('babylon');

/**
 * Generates a catch block given a function name
 */
var getCatchBlock = function (functionName) {
  return `
    var Err = require('babel-plugin-pretty-path-errors/src/Err.js');
    var path = '${functionName}';

    if (err.name === 'PrettyPathError') {
      path = path + ' -> ' + err.functionPath;
    }

    throw new Err(err, path);
  `;
};

var insertTryStatement = function ({ path, body, name, t }) {
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
    babylon.parse(getCatchBlock(name)).program.body
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

var modifyTryStatement = function ({ path, body, name, existingTryStatement, t }) {
  const handlerBody = existingTryStatement.handler.body.body;
  const catchBody = handlerBody.concat(
    babylon.parse(getCatchBlock(name)).program.body
  );

  existingTryStatement.handler.body = t.blockStatement(catchBody);
};

module.exports = function ({ types: t }) {
  return {
    visitor: {

      /**
       * Add Program visitor to traverse first, avoiding possibility of
       * function names being changed by other plugins
       */
      Program(programPath) {
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
            if (path.node.type === 'ClassMethod') {
              name = path.parentPath.container.id.name + ' -> ' + name;
            }

            if (path.node.body && path.node.body.body) {
              body = path.node.body.body;
            }

            // Ignore if try statement already exists
            var existingTryStatement = body.find(function(body) {
              return t.isTryStatement(body);
            });

            if (existingTryStatement) {
              modifyTryStatement({ path, name, body, existingTryStatement, t })
            } else {
              insertTryStatement({ path, name, body, t });
            }
          }
        });
      },
    }
  }
};
