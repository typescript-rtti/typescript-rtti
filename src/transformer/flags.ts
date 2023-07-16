import ts from 'typescript';
import * as format from '../common/format';
import { hasModifier } from './utils';

export function getVisibility(modifiers: readonly ts.Modifier[]) {
    if (modifiers) {
        if (modifiers.some(x => x.kind === ts.SyntaxKind.PublicKeyword))
            return format.F_PUBLIC;
        if (modifiers.some(x => x.kind === ts.SyntaxKind.PrivateKeyword))
            return format.F_PRIVATE;
        if (modifiers.some(x => x.kind === ts.SyntaxKind.ProtectedKeyword))
            return format.F_PROTECTED;
    }

    return '';
}

export function isReadOnly(modifiers: readonly ts.Modifier[]) {
    if (!modifiers)
        return '';

    return modifiers.some(x => x.kind === ts.SyntaxKind.ReadonlyKeyword) ? format.F_READONLY : '';
}

export function isAbstract(modifiers: readonly ts.Modifier[]) {
    if (!modifiers)
        return '';

    return modifiers.some(x => x.kind === ts.SyntaxKind.AbstractKeyword) ? format.F_ABSTRACT : '';
}

export function isAsync(modifiers: readonly ts.Modifier[]) {
    if (!modifiers)
        return '';

    return modifiers.some(x => x.kind === ts.SyntaxKind.AsyncKeyword) ? format.F_ASYNC : '';
}

export function isExported(modifiers: readonly ts.Modifier[]) {
    if (!modifiers)
        return '';

    return modifiers.some(x => x.kind === ts.SyntaxKind.ExportKeyword) ? format.F_EXPORTED : '';
}

export function methodFlags(decl: ts.MethodDeclaration) {
    const nodeModifiers = ts.canHaveModifiers(decl) ? ts.getModifiers(decl) : [];
    return [
        format.F_METHOD,
        getVisibility(nodeModifiers),
        decl.questionToken ? format.F_OPTIONAL : '',
        hasModifier(nodeModifiers, ts.SyntaxKind.AbstractKeyword)
            ? format.F_ABSTRACT : '',
        hasModifier(nodeModifiers, ts.SyntaxKind.StaticKeyword)
            ? format.F_STATIC : '',
        decl.questionToken ? format.F_OPTIONAL : '',
        !decl.type ? format.F_INFERRED : '',
        isAsync(nodeModifiers) ? format.F_ASYNC : ''
    ].join('')
}