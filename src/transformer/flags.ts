import ts from 'typescript';
import { F_ABSTRACT, F_ASYNC, F_EXPORTED, F_PRIVATE, F_PROTECTED, F_PUBLIC, F_READONLY } from '../common/format';

export function getVisibility(modifiers: ts.ModifiersArray) {
    if (modifiers) {
        if (modifiers.some(x => x.kind === ts.SyntaxKind.PublicKeyword))
            return F_PUBLIC;
        if (modifiers.some(x => x.kind === ts.SyntaxKind.PrivateKeyword))
            return F_PRIVATE;
        if (modifiers.some(x => x.kind === ts.SyntaxKind.ProtectedKeyword))
            return F_PROTECTED;
    }

    return '';
}

export function isReadOnly(modifiers: ts.ModifiersArray) {
    if (!modifiers)
        return '';

    return modifiers.some(x => x.kind === ts.SyntaxKind.ReadonlyKeyword) ? F_READONLY : '';
}

export function isAbstract(modifiers: ts.ModifiersArray) {
    if (!modifiers)
        return '';

    return modifiers.some(x => x.kind === ts.SyntaxKind.AbstractKeyword) ? F_ABSTRACT : '';
}

export function isAsync(modifiers: ts.ModifiersArray) {
    if (!modifiers)
        return '';

    return modifiers.some(x => x.kind === ts.SyntaxKind.AsyncKeyword) ? F_ASYNC : '';
}

export function isExported(modifiers: ts.ModifiersArray) {
    if (!modifiers)
        return '';

    return modifiers.some(x => x.kind === ts.SyntaxKind.ExportKeyword) ? F_EXPORTED : '';
}