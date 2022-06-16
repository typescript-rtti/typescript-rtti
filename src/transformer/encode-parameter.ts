import ts from 'typescript';
import * as format from '../common/format';
import { forwardRef, functionForwardRef } from './forward-ref';
import { literalNode } from './literal-node';
import { TypeEncoderImpl } from './type-literal';

export function encodeParameter(encoder: TypeEncoderImpl, param: ts.ParameterDeclaration): format.RtSerialized<format.RtParameter> {
    let f: string[] = [];
    let checker = encoder.ctx.checker;

    if (param.modifiers) {
        for (let modifier of Array.from(param.modifiers)) {
            if (modifier.kind === ts.SyntaxKind.ReadonlyKeyword)
                f.push(format.F_READONLY);
            if (modifier.kind === ts.SyntaxKind.PrivateKeyword)
                f.push(format.F_PRIVATE);
            if (modifier.kind === ts.SyntaxKind.PublicKeyword)
                f.push(format.F_PUBLIC);
            if (modifier.kind === ts.SyntaxKind.ProtectedKeyword)
                f.push(format.F_PROTECTED);
        }
    }

    if (param.questionToken)
        f.push(format.F_OPTIONAL);

    if (param.dotDotDotToken)
        f.push(format.F_REST);

    let typeExpr = param.type
        ? encoder.referToTypeNode(param.type)
        : encoder.referToType(checker.getTypeAtLocation(param.initializer), param.type)
    ;

    let meta: format.RtSerialized<format.RtParameter> = {
        n: param.name?.getText(),
        t: literalNode(forwardRef(typeExpr)),
        v: param.initializer ? literalNode(functionForwardRef(param.initializer)) : null
    };

    if (f.length > 0)
        meta.f = f.join('');

    return meta;
}
