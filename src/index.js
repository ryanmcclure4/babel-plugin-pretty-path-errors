var babylon = require('babylon');

/**
 * Generates a catch block given a function name
 */
var getCatchBlock = function (functionName) {
  return `
    var Err = require('babel-plugin-async-errors/src/Err.js');
    var path = '${functionName}';

    if (err.name === 'PrettyPathError') {
      path = err.functionPath + ' -> ' + path;
    }

    throw new Err(err, path);
  `;
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
            // Ignore if no function name
            if (!path.node.id) return;

            // Ignore if try statement already exists
            if (
              path.node.body &&
              path.node.body.body &&
              t.isTryStatement(path.node.body.body[0])
            ) return;

            var name = path.node.id.name;

            path.node.body = t.blockStatement([
              t.tryStatement(
                path.node.body,
                t.catchClause(
                  t.identifier('err'),
                  t.blockStatement(
                    babylon.parse(getCatchBlock(name)).program.body
                  )
                )
              )
            ]);
          }
        });
      },
    }
  }
};
