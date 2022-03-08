import ts from 'typescript';

export function getRootNameOfQualifiedName(qualifiedName : ts.QualifiedName): string {
    if (ts.isQualifiedName(qualifiedName.left))
        return getRootNameOfQualifiedName(qualifiedName.left);
    else if (ts.isIdentifier(qualifiedName.left))
        return qualifiedName.left.text;
}

export function getRootNameOfEntityName(entityName : ts.EntityName): string {
    if (ts.isQualifiedName(entityName)) {
        return getRootNameOfQualifiedName(entityName);
    } else if (ts.isIdentifier(entityName)) {
        return entityName.text;
    }
}

export function hasFlag(flags : number, flag : number) {
    return (flags & flag) !== 0;
}

export function hasAnyFlag(flags : number, possibleFlags : number[]) {
    return possibleFlags.some(x => hasFlag(flags, x));
}

export function isFlagType<T extends ts.Type>(type : ts.Type, flag : number): type is T {
    return hasFlag(type.flags, flag);
}

export function cloneQualifiedName(qualifiedName : ts.QualifiedName, rootName? : string) {
    let left : ts.Expression;
    if (ts.isIdentifier(qualifiedName.left)) {
        left = ts.factory.createIdentifier(rootName);
    } else {
        left = cloneEntityNameAsExpr(qualifiedName.left, rootName)   
    }
    return ts.factory.createPropertyAccessExpression(left, cloneEntityNameAsExpr(qualifiedName.right));
}

export function cloneEntityNameAsExpr(entityName : ts.EntityName, rootName? : string) {
    if (ts.isQualifiedName(entityName))
        return cloneQualifiedName(entityName, rootName);
    else if (ts.isIdentifier(entityName))
        return ts.factory.createIdentifier(entityName.text);
}

export function qualifiedNameToString(qualifiedName : ts.QualifiedName) {
    return ts.isIdentifier(qualifiedName.left) 
        ? qualifiedName.left.text + '.' + qualifiedName.right.text
        : entityNameToString(qualifiedName.left) + '.' + qualifiedName.right.text
    ;
}

export function entityNameToString(entityName : ts.EntityName) {
    if (ts.isQualifiedName(entityName))
        return qualifiedNameToString(entityName);
    else if (ts.isIdentifier(entityName))
        return entityName.text;
}        

export type SerializedEntityNameAsExpression = ts.Identifier | ts.BinaryExpression | ts.PropertyAccessExpression;

function createCheckedValue(left: ts.Expression, right: ts.Expression) {
    return ts.factory.createLogicalAnd(
        ts.factory.createStrictInequality(ts.factory.createTypeOfExpression(left), ts.factory.createStringLiteral("undefined")),
        right
    );
}

export type Mutable<T extends object> = { -readonly [K in keyof T]: T[K] };

/**
 * Bypasses immutability and directly sets the `parent` property of a `Node`.
 */
/* @internal */
export function setParent<T extends ts.Node>(child: T, parent: T["parent"] | undefined): T;
/* @internal */
export function setParent<T extends ts.Node>(child: T | undefined, parent: T["parent"] | undefined): T | undefined;
export function setParent<T extends ts.Node>(child: T | undefined, parent: T["parent"] | undefined): T | undefined {
    if (child && parent) {
        (child as Mutable<T>).parent = parent;
    }
    return child;
}

/**
 * Serializes an entity name which may not exist at runtime, but whose access shouldn't throw
 *
 * @param node The entity name to serialize.
 */
export function serializeEntityNameAsExpressionFallback(
    node: ts.EntityName, 
    context : ts.TransformationContext, 
    currentLexicalScope : ts.SourceFile | ts.Block | ts.ModuleBlock | ts.CaseBlock
): ts.BinaryExpression {
    if (node.kind === ts.SyntaxKind.Identifier) {
        // A -> typeof A !== undefined && A
        const copied = serializeEntityNameAsExpression(node, currentLexicalScope);
        return createCheckedValue(copied, copied);
    }
    if (node.left.kind === ts.SyntaxKind.Identifier) {
        // A.B -> typeof A !== undefined && A.B
        return createCheckedValue(serializeEntityNameAsExpression(node.left, currentLexicalScope), serializeEntityNameAsExpression(node, currentLexicalScope));
    }
    // A.B.C -> typeof A !== undefined && (_a = A.B) !== void 0 && _a.C
    const left = serializeEntityNameAsExpressionFallback(node.left, context, currentLexicalScope);
    const temp = ts.factory.createTempVariable(context.hoistVariableDeclaration);
    return ts.factory.createLogicalAnd(
        ts.factory.createLogicalAnd(
            left.left,
            ts.factory.createStrictInequality(ts.factory.createAssignment(temp, left.right), ts.factory.createVoidZero())
        ),
        ts.factory.createPropertyAccessExpression(temp, node.right)
    );
}
/**
 * Serializes an entity name as an expression for decorator type metadata.
 *
 * @param node The entity name to serialize.
 */
export function serializeEntityNameAsExpression(node: ts.EntityName, currentLexicalScope : ts.SourceFile | ts.Block | ts.ModuleBlock | ts.CaseBlock) {
   switch (node.kind) {
       case ts.SyntaxKind.Identifier:
           // Create a clone of the name with a new parent, and treat it as if it were
           // a source tree node for the purposes of the checker.
           
           const name = setParent(ts.setTextRange(<typeof node>ts.factory['cloneNode'](node), node), node.parent);
           name['original'] = undefined;
           setParent(name, ts.getParseTreeNode(currentLexicalScope)); // ensure the parent is set to a parse tree node.
           return name;

       case ts.SyntaxKind.QualifiedName:
           return serializeQualifiedNameAsExpression(node, currentLexicalScope);
   }
}

/**
 * Serializes an qualified name as an expression for decorator type metadata.
 *
 * @param node The qualified name to serialize.
 * @param useFallback A value indicating whether to use logical operators to test for the
 *                    qualified name at runtime.
 */
function serializeQualifiedNameAsExpression(node: ts.QualifiedName, currentLexicalScope : ts.SourceFile | ts.Block | ts.ModuleBlock | ts.CaseBlock): ts.PropertyAccessExpression {
    return ts.factory.createPropertyAccessExpression(serializeEntityNameAsExpression(node.left, currentLexicalScope), node.right);
}

export function dottedNameToExpr(dottedName : string) : ts.Identifier | ts.PropertyAccessExpression {
    return dottedName
        .split('.')
        .map(ident => ts.factory.createIdentifier(ident) as (ts.Identifier | ts.PropertyAccessExpression))
        .reduce((pv, cv : ts.Identifier) => 
            pv 
                ? ts.factory.createPropertyAccessExpression(pv, cv) 
                : cv
        )
    ;
}

export function propertyPrepend(expr : ts.Expression, propAccess : ts.PropertyAccessExpression | ts.Identifier) {
    if (ts.isIdentifier(propAccess)) {
        return ts.factory.createPropertyAccessExpression(expr, propAccess);
    } else if (ts.isPropertyAccessExpression(propAccess.expression)) {
        return ts.factory.createPropertyAccessExpression(propertyPrepend(expr, propAccess.expression), propAccess.name);
    } else if (ts.isIdentifier(propAccess.expression)) {
        return ts.factory.createPropertyAccessExpression( 
            ts.factory.createPropertyAccessExpression(
                expr,
                propAccess.expression
            ),
            propAccess.name
        );
    } else {
        console.dir(propAccess);
        throw new Error(`Unsupported expression type '${ts.SyntaxKind[propAccess.kind]}'`);
    }
}

export function expressionForPropertyName(propName : ts.PropertyName) {
    if (ts.isComputedPropertyName(propName)) {
        return propName.expression; // TODO: reuse of node might not be a good idea, but it does work
    } else if (ts.isIdentifier(propName)) {
        return ts.factory.createStringLiteral(propName.text);
    } else if (ts.isStringLiteral(propName)) {
        return ts.factory.createStringLiteral(propName.text);
    } else if (ts.isPrivateIdentifier(propName)) {
        return ts.factory.createStringLiteral(propName.text);
    } else {
        throw new Error(`Unexpected property name node of type '${ts.SyntaxKind[propName.kind]}'! Please file a bug!`);
    }
}

export function hasModifier(modifiers : ts.ModifiersArray, modifier : ts.SyntaxKind) {
    return modifiers?.some(x => x.kind === modifier) ?? false;
}