/**
 * Transform `yield [` to `yield all([`
 */

module.exports = function(fileInfo, api, options) {
    const YIELD_CALL = {
        type: "YieldExpression"
    };
    const ARRAY_CALL = {
        type: "ArrayExpression"
    };
    const IMPORT_CALL = {
        type: "ImportDeclaration"
    };
    const { jscodeshift: j } = api;
    const { statement } = j.template;
    const source = fileInfo.source;

    const root = j(fileInfo.source);
    const yieldArrays = root
        .find(j.YieldExpression, YIELD_CALL)
        .filter(p => p.value.argument.type === ARRAY_CALL.type);
    const hasYieldArrays = yieldArrays.size() > 0;
    if (!hasYieldArrays) {
        return false;
    }
    // Check to make sure that we have redux-saga's `all` imported
    const effects = root.find(j.ImportDeclaration, IMPORT_CALL).filter(p => {
        return p.value.source.value === "redux-saga/effects";
    });
    const hasEffects = effects.size() > 0;
    const hasAllEffect =
        effects
            .filter(p => {
                return p.value.specifiers.some(s => s.imported.name === "all");
            })
            .size() > 0;
    if (!hasAllEffect && hasEffects) {
        effects.forEach(p => {
            if (p.value.specifiers) {
                j(p).replaceWith(
                    j.importDeclaration(
                        [
                            j.importSpecifier(j.identifier("all")),
                            ...p.value.specifiers
                        ],
                        j.literal("redux-saga/effects")
                    )
                );
            }
        });
    }
    if (!hasEffects) {
        const importStatement = j.importDeclaration(
            [j.importSpecifier(j.identifier("all"))],
            j.literal("redux-saga/effects")
        );
        const firstNode = root.find(j.Program).get("body", 0).node;
        const { comments } = firstNode;
        if (comments) {
            delete firstNode.comments;
            importStatement.comments = comments;
        }
        root
            .find(j.Program)
            .get("body", 0)
            .insertBefore(importStatement);
    }
    root
        .find(j.YieldExpression, YIELD_CALL)
        .filter(p => {
            return p.value.argument.type === ARRAY_CALL.type;
        })
        .forEach(p => {
            j(p).replaceWith(
                j.yieldExpression(
                    j.callExpression(j.identifier("all"), [p.value.argument])
                )
            );
        });
    return root.toSource(options.printOptions);
};
