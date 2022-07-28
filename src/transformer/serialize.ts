import ts, {Statement, TransformationContext} from 'typescript';
import {isCodeNode, isConstructorFunction, isLiteralNode, isStatementNode, RtSerialized} from '../common';
import {cloneNode} from "ts-clone-node";

/**
 * String template literal serializer.
 * Example: Serialize`(${arg1},${arg2}) => ${expr}`
 * @param strings
 * @param keys
 * @constructor
 */
export function Serialize(strings, ...keys) {

    if (keys.length === 0) {
        return serializeStringToExpression(strings[0])
    }

    /* build an identifier map with keys */
    const identifierMap = [];
    let id = 0;
    for (let v of keys) {
        const value = identifierMap.find(x => x.original === v);
        // prevent double serialization of the same object
        if (value) {
            identifierMap.push(value);
            continue;
        }
        // strings can be literals or identifier, so we use them as identifier by default
        if (typeof v === 'string') {
            identifierMap.push({
                name: v.toString(),
                original: v,
            })
            continue;
        }
        identifierMap.push({
            value: serialize(v),
            original: v,
            name: "_TmpSerializerIdentifier" + id++
        });
    }

    // build string template
    let str = "";
    for (let i = 0; i < strings.length; i++) {
        str += strings[i];
        if (i < keys.length) {
            const key = identifierMap[i];
            str += `${key.name}`;
        }
    }

    /* check if we need to substitute values */
    const needtrans = identifierMap.find(x => x.value !== undefined);
    if (!needtrans) {
        return serializeStringToExpression(str)
    }

    // transform the code to a node, only the first node is used
    const ser = serializeString(str);


    // walk the node and replace identifiers with keys
    const _visit = (ctx) => {
        return function visit(node: ts.Node) {
            if (!node)
                return;
            if (node.kind === ts.SyntaxKind.Identifier) {
                const n = node as ts.Identifier;
                const v = identifierMap.find(x => x.name === n.text);
                if (v && v.value !== undefined) {
                    // replace the node with the expression value
                    return v.value;
                }
                return n;
            }

            return ts.visitEachChild(node, visit, ctx);
        }
    }

    let result = ts.transform(
        ser,
        [transformContext => sourceFile => ts.visitNode(sourceFile, _visit(transformContext))],
        {
            noEmit: true,
        }
    ).transformed[0];

    const statement = result.statements[0];
    if (statement == null) {
        throw new Error(`serializeStringToAst code does not contain a statement ${str}`);
    }

    return serialize(statement);
}

// we could cache the result of this function for performance
let fileId = 0;
export function serializeStringToExpression(str: string): ts.Expression {
    const filename = `____${fileId++}.ts`;
    const code = str;

    const sourceFile = ts.createSourceFile(
        filename, code, ts.ScriptTarget.ES2016, true, ts.ScriptKind.TS
    );

    const statement = cloneNode(sourceFile,{
        setParents: false,
        setOriginalNodes: false,
        preserveSymbols: false,
        preserveComments: false,
    }).statements[0]; // we need to clone the node to prevent emit errors and corruptions
    if (statement == null) {
        throw new Error(`serializeStringToAst code does not contain a statement ${code}`);
    }

    return serializeExpression(statement);
}

// we could cache the result of this function for performance
export function serializeString(str: string): ts.SourceFile {
    const filename = `____${fileId++}.ts`;
    const code = str;

    const sourceFile = ts.createSourceFile(
        filename, code, ts.ScriptTarget.ES2016, true, ts.ScriptKind.TS
    );

    return cloneNode(sourceFile,{
        setParents: false,
        setOriginalNodes: false,
        preserveSymbols: false,
        preserveComments: false,
    }); // we need to clone the node to prevent emit errors and corruptions
}

function isTypescriptNode(x: any): x is ts.Node {
    if (!x)
        return false;
    if (x.kind === undefined)
        return false;
    if (x.flags === undefined)
        return false;
    if (x.pos === undefined)
        return false;
    if (x.end === undefined)
        return false;
    return true
}

/* generic serializer */
export function serialize<T>(object: any): ts.Expression | ts.Statement {
    if (object === null)
        return ts.factory.createNull();
    if (object === undefined)
        return ts.factory.createVoidZero();

    if (object instanceof Array) {
        return ts.factory.createArrayLiteralExpression(object.map(x => {
            const s = serialize(x);
            if (isStatementNode(s)) {
                throw new Error(`Serialize: cannot put a statement in an object literal`);
            }
            return <ts.Expression>serialize(x)
        }));
    }
    if (typeof object === 'string')
        return ts.factory.createStringLiteral(object);
    if (typeof object === 'number')
        return ts.factory.createNumericLiteral(object);
    if (typeof object === 'boolean')
        return object ? ts.factory.createTrue() : ts.factory.createFalse();
    if (typeof object === 'function') {
        //const code = object.toString();
        // injected code like coverage broke the serializer
        //return serializeStringToExpression(code);
        throw new Error(`serialize: cannot serialize function because of coverage code injection, use serializeStringToExpression or Serialize string template`);
    }
    if (typeof object === 'symbol') {
        return ts.factory.createCallExpression(
            ts.factory.createIdentifier("Symbol"),
            undefined,
            [ts.factory.createStringLiteral(object.toString().slice(7, -1))]
        )
    }
    if (isLiteralNode(object))
        return object.node;
    if (isCodeNode(object))
        return serializeStringToExpression(object.code);

    // check if the object is a typescript node
    if (isTypescriptNode(object)) {
        // check if the node is an expression of any kind
        if (object.kind === ts.SyntaxKind.ExpressionStatement) {
            return (object as ts.ExpressionStatement).expression;
        }
        if (object.kind === ts.SyntaxKind.BinaryExpression) {
            return (object as ts.BinaryExpression);
        }
        if (object.kind === ts.SyntaxKind.CallExpression) {
            return (object as ts.CallExpression);
        }
        if (object.kind === ts.SyntaxKind.Identifier) {
            return (object as ts.Identifier);
        }
        if (object.kind === ts.SyntaxKind.LiteralType) {
            return object as ts.Expression;
        }
        if (object.kind === ts.SyntaxKind.StringLiteral) {
            return object as ts.StringLiteral;
        }
        if (object.kind === ts.SyntaxKind.NumericLiteral) {
            return object as ts.NumericLiteral;
        }
        if (object.kind === ts.SyntaxKind.TrueKeyword) {
            return serialize(true);
        }
        if (object.kind === ts.SyntaxKind.FalseKeyword) {
            return serialize(false);
        }
        if (object.kind === ts.SyntaxKind.NullKeyword) {
            return serialize(null);
        }
        if (object.kind === ts.SyntaxKind.UndefinedKeyword) {
            return serialize(undefined);
        }
        if (object.kind === ts.SyntaxKind.ArrayLiteralExpression) {
            return object as ts.ArrayLiteralExpression;
        }
        if (object.kind === ts.SyntaxKind.ObjectLiteralExpression) {
            return object as ts.ObjectLiteralExpression;
        }
        if (object.kind === ts.SyntaxKind.PropertyAccessExpression) {
            return object as ts.PropertyAccessExpression;
        }
        if (object.kind === ts.SyntaxKind.ArrowFunction) {
            return object as ts.ArrowFunction;
        }
        if (object.kind === ts.SyntaxKind.FunctionExpression) {
            return object as ts.FunctionExpression;
        }
        if (object.kind === ts.SyntaxKind.VariableStatement) {
            return object as ts.VariableStatement;
        }
        throw new Error(`Serialize unsupported node type: ${object.kind}`)
    }


    // Classes references like Date,Number,String,Boolean,Function, serialize as identifiers
    if (isConstructorFunction(object) && object.name) {
        return ts.factory.createIdentifier(object.name)
    }

    let props: ts.ObjectLiteralElementLike[] = [];
    for (let key of Object.keys(object)) {
        const s = serialize(object[key]);
        if (isStatementNode(s)) {
            throw new Error(`Serialize: cannot put a statement in an object literal`);
        }
        props.push(ts.factory.createPropertyAssignment(key, <ts.Expression>s));
    }

    return ts.factory.createObjectLiteralExpression(props, false);
}

export function serializeExpression<T>(object: any): ts.Expression {
    const s = serialize(object);
    if (isStatementNode(s)) {
        throw new Error(`serializeExpression: cannot serialize to expression`);
    }
    return s as ts.Expression;
}

