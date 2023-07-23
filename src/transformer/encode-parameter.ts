import ts from 'typescript';
import * as format from '../common/format';
import { functionForwardRef } from './forward-ref';
import { literalNode } from './literal-node';
import { TypeEncoderImpl } from './type-literal';
import { cloneNode, getModifiers } from './utils';

export function encodeParameter(encoder: TypeEncoderImpl, param: ts.ParameterDeclaration | ts.BindingElement | ts.OmittedExpression): format.RtSerialized<format.RtParameter> {

    if (ts.isOmittedExpression(param))
        return { f: ',' };

    let nameNode = param.name;
    let bindings: format.RtSerialized<format.RtParameter>[];
    let name: string;
    let f: string[] = [];
    let typeExpr: ts.Expression;
    let checker = encoder.ctx.checker;

    if (ts.isArrayBindingPattern(nameNode)) {
        f.push(format.F_ARRAY_BINDING);

        bindings = [];
        for (let element of nameNode.elements) {
            bindings.push(encodeParameter(encoder, element));
        }
    } else if (ts.isObjectBindingPattern(nameNode)) {
        f.push(format.F_OBJECT_BINDING);

        bindings = [];
        for (let element of nameNode.elements) {
            bindings.push(encodeParameter(encoder, element));
        }
    } else {
        name = nameNode.text;
    }

    if (ts.isParameter(param)) {
        if (param.questionToken)
            f.push(format.F_OPTIONAL);

        if (param.dotDotDotToken)
            f.push(format.F_REST);

        typeExpr = param.type
            ? encoder.referToTypeNode(param.type)
            : encoder.referToType(checker.getTypeAtLocation(param.initializer), param.type)
        ;
    } else {
        typeExpr = encoder.referToType(checker.getTypeAtLocation(param));
    }

    for (let modifier of getModifiers(param)) {
        if (modifier.kind === ts.SyntaxKind.ReadonlyKeyword)
            f.push(format.F_READONLY);
        if (modifier.kind === ts.SyntaxKind.PrivateKeyword)
            f.push(format.F_PRIVATE);
        if (modifier.kind === ts.SyntaxKind.PublicKeyword)
            f.push(format.F_PUBLIC);
        if (modifier.kind === ts.SyntaxKind.ProtectedKeyword)
            f.push(format.F_PROTECTED);
    }

    let meta: format.RtSerialized<format.RtParameter> = {
        n: name,
        t: literalNode(typeExpr),
        ...bindings ? { b: bindings } : {},
        ...param.initializer ? { v: literalNode(functionForwardRef(ts.getSynthesizedDeepClone(param.initializer))) } : {}
    };

    if (f.length > 0)
        meta.f = f.join('');

    return meta;
}
