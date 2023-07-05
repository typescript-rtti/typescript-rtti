import ts from 'typescript';
import { RttiContext } from './rtti-context';

export function isInterfaceType(type: ts.Type) {
    return type.isClassOrInterface() && !type.isClass();
}

export function getRootNameOfQualifiedName(qualifiedName: ts.QualifiedName): string {
    if (ts.isQualifiedName(qualifiedName.left))
        return getRootNameOfQualifiedName(qualifiedName.left);
    else if (ts.isIdentifier(qualifiedName.left))
        return qualifiedName.left.text;
}

export function getRootNameOfEntityName(entityName: ts.EntityName): string {
    if (ts.isQualifiedName(entityName)) {
        return getRootNameOfQualifiedName(entityName);
    } else if (ts.isIdentifier(entityName)) {
        return entityName.text;
    }
}

export function hasFlag(flags: number, flag: number) {
    return (flags & flag) !== 0;
}

export function hasAnyFlag(flags: number, possibleFlags: number[]) {
    return possibleFlags.some(x => hasFlag(flags, x));
}

export function isFlagType<T extends ts.Type>(type: ts.Type, flag: number): type is T {
    return hasFlag(type.flags, flag);
}

export function cloneQualifiedName(qualifiedName: ts.QualifiedName, rootName?: string) {
    let left: ts.Expression;
    if (ts.isIdentifier(qualifiedName.left)) {
        left = ts.factory.createIdentifier(rootName);
    } else {
        left = cloneEntityNameAsExpr(qualifiedName.left, rootName);
    }
    return ts.factory.createPropertyAccessExpression(left, cloneEntityNameAsExpr(qualifiedName.right));
}

export function cloneEntityNameAsExpr(entityName: ts.EntityName, rootName?: string) {
    if (ts.isQualifiedName(entityName))
        return cloneQualifiedName(entityName, rootName);
    else if (ts.isIdentifier(entityName))
        return ts.factory.createIdentifier(entityName.text);
}

export function qualifiedNameToString(qualifiedName: ts.QualifiedName) {
    return ts.isIdentifier(qualifiedName.left)
        ? qualifiedName.left.text + '.' + qualifiedName.right.text
        : entityNameToString(qualifiedName.left) + '.' + qualifiedName.right.text
        ;
}

export function entityNameToString(entityName: ts.EntityName) {
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
    context: ts.TransformationContext,
    currentLexicalScope: ts.SourceFile | ts.Block | ts.ModuleBlock | ts.CaseBlock
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
export function serializeEntityNameAsExpression(node: ts.EntityName, currentLexicalScope: ts.SourceFile | ts.Block | ts.ModuleBlock | ts.CaseBlock) {
    switch (node.kind) {
        case ts.SyntaxKind.Identifier:
            // Create a clone of the name with a new parent, and treat it as if it were
            // a source tree node for the purposes of the checker.

            const name = setParent(ts.setTextRange(<typeof node>(ts.factory as any)['cloneNode'](node), node), node.parent);
            (name as any)['original'] = undefined;
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
function serializeQualifiedNameAsExpression(node: ts.QualifiedName, currentLexicalScope: ts.SourceFile | ts.Block | ts.ModuleBlock | ts.CaseBlock): ts.PropertyAccessExpression {
    return ts.factory.createPropertyAccessExpression(serializeEntityNameAsExpression(node.left, currentLexicalScope), node.right);
}

export function dottedNameToExpr(dottedName: string): ts.Identifier | ts.PropertyAccessExpression {
    return dottedName
        .split('.')
        .map(ident => ts.factory.createIdentifier(ident) as (ts.Identifier | ts.PropertyAccessExpression))
        .reduce((pv, cv) =>
            pv
                // @ts-ignore TODO
                ? ts.factory.createPropertyAccessExpression(pv, cv)
                : cv
        )
        ;
}

export function replacePropertyRoot(propertyExpr: ts.PropertyAccessExpression, newRootExpr: ts.Expression) {
    if (ts.isPropertyAccessExpression(propertyExpr.expression)) {
        return ts.factory.createPropertyAccessExpression(replacePropertyRoot(propertyExpr.expression, newRootExpr), propertyExpr.name);
    } else {
        return ts.factory.createPropertyAccessExpression(newRootExpr, propertyExpr.name);
    }
}

export function getPropertyRoot(propertyExpr: ts.PropertyAccessExpression) {
    if (ts.isPropertyAccessExpression(propertyExpr.expression))
        return getPropertyRoot(propertyExpr.expression);
    return propertyExpr.expression;
}

export function optionalExportRef(...args) {
    return null;
}

/**
 * Uses the `oe` utility function to perform a dynamic access of an object. This is used to ensure that
 * RTTI-specific exports which may not be present do not cause problems in build systems which statically
 * analyze whether the referenced export exists. (ie Angular's build process).
 *
 * Given optionalExportRef(<object>, <identifier>),
 *  outputs: __RΦ.oe(<object>, '<identifier>')
 *
 * Given optionalExportRef(<object>, <property-access>),
 *  outputs: __RΦ.oe(<object>, '<property-access-first-identifier>')[<property-access-rest>]
 *
 * @returns
 */
export function optionalExportRef2(object: ts.Expression, expr: ts.Identifier | ts.PropertyAccessExpression) {
    let propertyName: string;
    let propertyAccess: ts.PropertyAccessExpression;

    if (ts.isIdentifier(expr)) {
        propertyName = expr.text;
    } else if (ts.isPropertyAccessExpression(expr)) {
        let propertyRoot = getPropertyRoot(expr);

        propertyAccess = expr;
        if (ts.isIdentifier(propertyRoot)) {
            propertyName = propertyRoot.text;
        } else {
            throw new Error(`Property root should have been an identifier!`);
        }
    }

    let callExpr = ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__RΦ'), 'oe'),
        [],
        [
            object,
            ts.factory.createStringLiteral(propertyName)
        ]
    );

    if (propertyAccess)
        return replacePropertyRoot(propertyAccess, callExpr);

    return callExpr;
}

export function propertyPrepend(expr: ts.Expression, propAccess: ts.PropertyAccessExpression | ts.Identifier): ts.Expression {
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

export function expressionForPropertyName(propName: ts.PropertyName) {
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

export function propertyNameToString(propName: ts.PropertyName) {
    if (!propName)
        return `<undefined>`;

    if (propName.getSourceFile()) {
        return propName.getText();
    }

    if (ts.isComputedPropertyName(propName)) {
        return `(computed property name)`;
    } else if (ts.isIdentifier(propName)) {
        return propName.text;
    } else if (ts.isStringLiteral(propName)) {
        return `"${propName.text}"`;
    } else if (ts.isPrivateIdentifier(propName)) {
        return propName.text;
    } else {
        throw new Error(`Unexpected property name node of type '${ts.SyntaxKind[propName.kind]}'! Please file a bug!`);
    }
}

export function hasModifier(modifiers: readonly ts.Modifier[] | undefined, modifier: ts.SyntaxKind) {
    return modifiers?.some(x => x.kind === modifier) ?? false;
}

export function hasModifiers(modifiersArray: readonly ts.Modifier[] | undefined, modifiers: ts.SyntaxKind[]) {
    return modifiers.every(modifier => hasModifier(modifiersArray, modifier));
}

export function getModifiers(node: ts.Node): readonly ts.Modifier[] {
    return ts.canHaveModifiers(node) ? (ts.getModifiers(node) ?? []) : [];
}

export function getDecorators(node: ts.Node): readonly ts.Decorator[] {
    return ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
}

export function referenceSymbol(
    ctx: RttiContext,
    identifier: string,
    hasValue?: boolean
) {
    let typeImport = ctx.importMap.get(identifier);
    if (typeImport) {
        return referenceImportedSymbol(
            ctx,
            typeImport.modulePath,
            identifier, hasValue,
            typeImport.importDeclaration
        );
    } else {
        if (hasValue === false)
            return ts.factory.createIdentifier(`IΦ${identifier}`);
        else if (hasValue === true)
            return ts.factory.createIdentifier(identifier);

        return ts.factory.createBinaryExpression(
            ts.factory.createIdentifier(identifier),
            ts.factory.createToken(ts.SyntaxKind.QuestionQuestionToken),
            ts.factory.createIdentifier(`IΦ${identifier}`)
        );
    }
}

export function referenceImportedSymbol(
    ctx: RttiContext,
    modulePath: string,
    identifier: string,
    hasValue?: boolean,
    importDecl?: ts.Statement
) {
    let impo = ctx.importMap.get(`*:${modulePath}`);
    if (!impo) {
        ctx.importMap.set(`*:${modulePath}`, impo = {
            importDeclaration: importDecl ?? ctx.currentTopStatement,
            isDefault: false,
            isNamespace: true,
            localName: `LΦ_${ctx.freeImportReference++}`,
            modulePath: modulePath,
            name: `*:${modulePath}`,
            refName: '',
            referenced: true
        });
    }

    impo.referenced = true;

    if (hasValue === true) {
        return ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier(impo.localName), identifier);
    } else if (hasValue === false) {
        return ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier(impo.localName), `IΦ${identifier}`);
    }

    return ts.factory.createBinaryExpression(
        ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier(impo.localName), identifier),
        ts.factory.createToken(ts.SyntaxKind.QuestionQuestionToken),
        ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier(impo.localName), `IΦ${identifier}`)
    );
}

export function isExternalOrCommonJsModule(file: ts.SourceFile): boolean {
    return ((file as any)['externalModuleIndicator'] || (file as any)['commonJsModuleIndicator']) !== undefined;
}

export function* externalModules(program: ts.Program): Generator<[ts.Symbol, ts.SourceFile?]> {
    let checker = program.getTypeChecker();

    for (const ambient of checker.getAmbientModules()) {
        yield [ambient, /*sourceFile*/ undefined];
    }
    for (const sourceFile of program.getSourceFiles()) {
        if (isExternalOrCommonJsModule(sourceFile)) {
            yield [(checker as any)['getMergedSymbol']((sourceFile as any)['symbol']), sourceFile];
        }
    }
}

export function removeTrailingSlash(path: string) {
    return path.replace(/[/\\]+$/, '');
}

export function getDirectoryPath(path: string) {
    return removeTrailingSlash(removeTrailingSlash(path).replace(/[/\\][^/\\]+$/, ''));
}

export type Path = string & { __pathBrand: any; };

/**
 * Determines whether a path has a trailing separator (`/` or `\\`).
 */
export function hasTrailingDirectorySeparator(path: string) {
    return path.length > 0 && isAnyDirectorySeparator(path.charCodeAt(path.length - 1));
}

/**
 * Determines whether a charCode corresponds to `/` or `\`.
 */
export function isAnyDirectorySeparator(charCode: number): boolean {
    return charCode === CharacterCodes.slash || charCode === CharacterCodes.backslash;
}

/**
 * Removes a trailing directory separator from a path, if it does not already have one.
 *
 * ```ts
 * removeTrailingDirectorySeparator("/path/to/file.ext") === "/path/to/file.ext"
 * removeTrailingDirectorySeparator("/path/to/file.ext/") === "/path/to/file.ext"
 * ```
 */
export function removeTrailingDirectorySeparator(path: Path): Path;
export function removeTrailingDirectorySeparator(path: string): string;
export function removeTrailingDirectorySeparator(path: string) {
    if (hasTrailingDirectorySeparator(path)) {
        return path.substr(0, path.length - 1);
    }

    return path;
}

/**
 * Returns the path except for its containing directory name.
 * Semantics align with NodeJS's `path.basename` except that we support URL's as well.
 *
 * ```ts
 * // POSIX
 * getBaseFileName("/path/to/file.ext") === "file.ext"
 * getBaseFileName("/path/to/") === "to"
 * getBaseFileName("/") === ""
 * // DOS
 * getBaseFileName("c:/path/to/file.ext") === "file.ext"
 * getBaseFileName("c:/path/to/") === "to"
 * getBaseFileName("c:/") === ""
 * getBaseFileName("c:") === ""
 * // URL
 * getBaseFileName("http://typescriptlang.org/path/to/file.ext") === "file.ext"
 * getBaseFileName("http://typescriptlang.org/path/to/") === "to"
 * getBaseFileName("http://typescriptlang.org/") === ""
 * getBaseFileName("http://typescriptlang.org") === ""
 * getBaseFileName("file://server/path/to/file.ext") === "file.ext"
 * getBaseFileName("file://server/path/to/") === "to"
 * getBaseFileName("file://server/") === ""
 * getBaseFileName("file://server") === ""
 * getBaseFileName("file:///path/to/file.ext") === "file.ext"
 * getBaseFileName("file:///path/to/") === "to"
 * getBaseFileName("file:///") === ""
 * getBaseFileName("file://") === ""
 * ```
 */
export function getBaseFileName(path: string): string;
/**
 * Gets the portion of a path following the last (non-terminal) separator (`/`).
 * Semantics align with NodeJS's `path.basename` except that we support URL's as well.
 * If the base name has any one of the provided extensions, it is removed.
 *
 * ```ts
 * getBaseFileName("/path/to/file.ext", ".ext", true) === "file"
 * getBaseFileName("/path/to/file.js", ".ext", true) === "file.js"
 * getBaseFileName("/path/to/file.js", [".ext", ".js"], true) === "file"
 * getBaseFileName("/path/to/file.ext", ".EXT", false) === "file.ext"
 * ```
 */
export function getBaseFileName(path: string, extensions: string | readonly string[], ignoreCase: boolean): string;
export function getBaseFileName(path: string, extensions?: string | readonly string[], ignoreCase?: boolean) {
    path = normalizeSlashes(path);

    // if the path provided is itself the root, then it has not file name.
    const rootLength = getRootLength(path);
    if (rootLength === path.length) return "";

    // return the trailing portion of the path starting after the last (non-terminal) directory
    // separator but not including any trailing directory separator.
    path = removeTrailingDirectorySeparator(path);
    const name = path.slice(Math.max(getRootLength(path), path.lastIndexOf(directorySeparator) + 1));
    const extension = extensions !== undefined && ignoreCase !== undefined ? getAnyExtensionFromPath(name, extensions, ignoreCase) : undefined;
    return extension ? name.slice(0, name.length - extension.length) : name;
}

const backslashRegExp = /\\/g;
export const directorySeparator = "/";
export const altDirectorySeparator = "\\";
const urlSchemeSeparator = "://";

/**
 * Compare the equality of two strings using a case-sensitive ordinal comparison.
 *
 * Case-sensitive comparisons compare both strings one code-point at a time using the integer
 * value of each code-point after applying `toUpperCase` to each string. We always map both
 * strings to their upper-case form as some unicode characters do not properly round-trip to
 * lowercase (such as `ẞ` (German sharp capital s)).
 */
export function equateStringsCaseInsensitive(a: string, b: string) {
    return a === b
        || a !== undefined
        && b !== undefined
        && a.toUpperCase() === b.toUpperCase();
}

/**
 * Compare the equality of two strings using a case-sensitive ordinal comparison.
 *
 * Case-sensitive comparisons compare both strings one code-point at a time using the
 * integer value of each code-point.
 */
export function equateStringsCaseSensitive(a: string, b: string) {
    return a === b;
}
/**
 * Gets the file extension for a path, provided it is one of the provided extensions.
 *
 * ```ts
 * getAnyExtensionFromPath("/path/to/file.ext", ".ext", true) === ".ext"
 * getAnyExtensionFromPath("/path/to/file.js", ".ext", true) === ""
 * getAnyExtensionFromPath("/path/to/file.js", [".ext", ".js"], true) === ".js"
 * getAnyExtensionFromPath("/path/to/file.ext", ".EXT", false) === ""
 */
export function getAnyExtensionFromPath(path: string, extensions: string | readonly string[], ignoreCase: boolean): string;
export function getAnyExtensionFromPath(path: string, extensions?: string | readonly string[], ignoreCase?: boolean): string {
    // Retrieves any string from the final "." onwards from a base file name.
    // Unlike extensionFromPath, which throws an exception on unrecognized extensions.
    if (extensions) {
        return getAnyExtensionFromPathWorker(removeTrailingDirectorySeparator(path), extensions, ignoreCase ? equateStringsCaseInsensitive : equateStringsCaseSensitive);
    }
    const baseFileName = getBaseFileName(path);
    const extensionIndex = baseFileName.lastIndexOf(".");
    if (extensionIndex >= 0) {
        return baseFileName.substring(extensionIndex);
    }
    return "";
}

function getAnyExtensionFromPathWorker(path: string, extensions: string | readonly string[], stringEqualityComparer: (a: string, b: string) => boolean) {
    if (typeof extensions === "string") {
        return tryGetExtensionFromPath(path, extensions, stringEqualityComparer) || "";
    }
    for (const extension of extensions) {
        const result = tryGetExtensionFromPath(path, extension, stringEqualityComparer);
        if (result) return result;
    }
    return "";
}

function tryGetExtensionFromPath(path: string, extension: string, stringEqualityComparer: (a: string, b: string) => boolean) {
    if (!extension.startsWith(".")) extension = "." + extension;
    if (path.length >= extension.length && path.charCodeAt(path.length - extension.length) === CharacterCodes.dot) {
        const pathExtension = path.slice(path.length - extension.length);
        if (stringEqualityComparer(pathExtension, extension)) {
            return pathExtension;
        }
    }
}
/**
 * Returns length of the root part of a path or URL (i.e. length of "/", "x:/", "//server/share/, file:///user/files").
 *
 * For example:
 * ```ts
 * getRootLength("a") === 0                   // ""
 * getRootLength("/") === 1                   // "/"
 * getRootLength("c:") === 2                  // "c:"
 * getRootLength("c:d") === 0                 // ""
 * getRootLength("c:/") === 3                 // "c:/"
 * getRootLength("c:\\") === 3                // "c:\\"
 * getRootLength("//server") === 7            // "//server"
 * getRootLength("//server/share") === 8      // "//server/"
 * getRootLength("\\\\server") === 7          // "\\\\server"
 * getRootLength("\\\\server\\share") === 8   // "\\\\server\\"
 * getRootLength("file:///path") === 8        // "file:///"
 * getRootLength("file:///c:") === 10         // "file:///c:"
 * getRootLength("file:///c:d") === 8         // "file:///"
 * getRootLength("file:///c:/path") === 11    // "file:///c:/"
 * getRootLength("file://server") === 13      // "file://server"
 * getRootLength("file://server/path") === 14 // "file://server/"
 * getRootLength("http://server") === 13      // "http://server"
 * getRootLength("http://server/path") === 14 // "http://server/"
 * ```
 */
export function getRootLength(path: string) {
    const rootLength = getEncodedRootLength(path);
    return rootLength < 0 ? ~rootLength : rootLength;
}


function isVolumeCharacter(charCode: number) {
    return (charCode >= CharacterCodes.a && charCode <= CharacterCodes.z) ||
        (charCode >= CharacterCodes.A && charCode <= CharacterCodes.Z);
}

function getFileUrlVolumeSeparatorEnd(url: string, start: number) {
    const ch0 = url.charCodeAt(start);
    if (ch0 === CharacterCodes.colon) return start + 1;
    if (ch0 === CharacterCodes.percent && url.charCodeAt(start + 1) === CharacterCodes._3) {
        const ch2 = url.charCodeAt(start + 2);
        if (ch2 === CharacterCodes.a || ch2 === CharacterCodes.A) return start + 3;
    }
    return -1;
}

/**
 * Returns length of the root part of a path or URL (i.e. length of "/", "x:/", "//server/share/, file:///user/files").
 * If the root is part of a URL, the twos-complement of the root length is returned.
 */
function getEncodedRootLength(path: string): number {
    if (!path) return 0;
    const ch0 = path.charCodeAt(0);

    // POSIX or UNC
    if (ch0 === CharacterCodes.slash || ch0 === CharacterCodes.backslash) {
        if (path.charCodeAt(1) !== ch0) return 1; // POSIX: "/" (or non-normalized "\")

        const p1 = path.indexOf(ch0 === CharacterCodes.slash ? directorySeparator : altDirectorySeparator, 2);
        if (p1 < 0) return path.length; // UNC: "//server" or "\\server"

        return p1 + 1; // UNC: "//server/" or "\\server\"
    }

    // DOS
    if (isVolumeCharacter(ch0) && path.charCodeAt(1) === CharacterCodes.colon) {
        const ch2 = path.charCodeAt(2);
        if (ch2 === CharacterCodes.slash || ch2 === CharacterCodes.backslash) return 3; // DOS: "c:/" or "c:\"
        if (path.length === 2) return 2; // DOS: "c:" (but not "c:d")
    }

    // URL
    const schemeEnd = path.indexOf(urlSchemeSeparator);
    if (schemeEnd !== -1) {
        const authorityStart = schemeEnd + urlSchemeSeparator.length;
        const authorityEnd = path.indexOf(directorySeparator, authorityStart);
        if (authorityEnd !== -1) { // URL: "file:///", "file://server/", "file://server/path"
            // For local "file" URLs, include the leading DOS volume (if present).
            // Per https://www.ietf.org/rfc/rfc1738.txt, a host of "" or "localhost" is a
            // special case interpreted as "the machine from which the URL is being interpreted".
            const scheme = path.slice(0, schemeEnd);
            const authority = path.slice(authorityStart, authorityEnd);
            if (scheme === "file" && (authority === "" || authority === "localhost") &&
                isVolumeCharacter(path.charCodeAt(authorityEnd + 1))) {
                const volumeSeparatorEnd = getFileUrlVolumeSeparatorEnd(path, authorityEnd + 2);
                if (volumeSeparatorEnd !== -1) {
                    if (path.charCodeAt(volumeSeparatorEnd) === CharacterCodes.slash) {
                        // URL: "file:///c:/", "file://localhost/c:/", "file:///c%3a/", "file://localhost/c%3a/"
                        return ~(volumeSeparatorEnd + 1);
                    }
                    if (volumeSeparatorEnd === path.length) {
                        // URL: "file:///c:", "file://localhost/c:", "file:///c$3a", "file://localhost/c%3a"
                        // but not "file:///c:d" or "file:///c%3ad"
                        return ~volumeSeparatorEnd;
                    }
                }
            }
            return ~(authorityEnd + 1); // URL: "file://server/", "http://server/"
        }
        return ~path.length; // URL: "file://server", "http://server"
    }

    // relative
    return 0;
}

/**
 * Normalize path separators, converting `\` into `/`.
 */
export function normalizeSlashes(path: string): string {
    return path.replace(backslashRegExp, directorySeparator);
}

export function getParentOfSymbol(symbol: ts.Symbol): ts.Symbol {
    return (symbol as any)['parent'];
}

export const enum ImportKind {
    Named,
    Default,
    Namespace,
    CommonJS,
}

export function getDefaultLikeExportInfo(
    importingFile: ts.SourceFile,
    moduleSymbol: ts.Symbol,
    checker: ts.TypeChecker,
    compilerOptions: ts.CompilerOptions,
): { readonly symbol: ts.Symbol, readonly symbolForMeaning: ts.Symbol, readonly name?: string, readonly kind: ImportKind; } | undefined {
    const exported = getDefaultLikeExportWorker(importingFile, moduleSymbol, checker, compilerOptions);
    if (!exported) return undefined;
    const { symbol, kind } = exported;
    const info = getDefaultExportInfoWorker(symbol, checker, compilerOptions);
    return info && { symbol, kind, ...info };
}

function getDefaultExportInfoWorker(defaultExport: ts.Symbol, checker: ts.TypeChecker, compilerOptions: ts.CompilerOptions): { readonly symbolForMeaning: ts.Symbol, readonly name?: string; } | undefined {
    const localSymbol = getLocalSymbolForExportDefault(defaultExport);
    if (localSymbol) return { symbolForMeaning: localSymbol, name: localSymbol.name };

    const name = getNameForExportDefault(defaultExport);
    if (name !== undefined) return { symbolForMeaning: defaultExport, name };

    if (defaultExport.flags & ts.SymbolFlags.Alias) {
        const aliased = checker.getImmediateAliasedSymbol(defaultExport);
        if (aliased && getParentOfSymbol(aliased)) {
            // - `aliased` will be undefined if the module is exporting an unresolvable name,
            //    but we can still offer completions for it.
            // - `aliased.parent` will be undefined if the module is exporting `globalThis.something`,
            //    or another expression that resolves to a global.
            return getDefaultExportInfoWorker(aliased, checker, compilerOptions);
        }
    }

    if (defaultExport.escapedName !== ts.InternalSymbolName.Default &&
        defaultExport.escapedName !== ts.InternalSymbolName.ExportEquals) {
        return { symbolForMeaning: defaultExport, name: defaultExport.getName() };
    }
    return { symbolForMeaning: defaultExport, name: getNameForExportedSymbol(defaultExport, compilerOptions.target) };
}

function getSymbolParentOrFail(symbol: ts.Symbol) {
    let parent = getParentOfSymbol(symbol);
    if (!parent) {
        throw new Error(
            `RTTI: Symbol parent was undefined. Flags: ${symbol.flags}. ` +
            `Declarations: ${symbol.declarations?.map(d => {
                const inJS = isInJSFile(d);
                const { expression } = d as any;
                return (inJS ? "[JS]" : "") + d.kind + (expression ? ` (expression: ${expression.kind})` : "");
            }).join(", ")}.`
        );
    }

    return parent;
}

export function getNameForExportedSymbol(symbol: ts.Symbol, scriptTarget: ts.ScriptTarget | undefined) {
    if (!(symbol.flags & ts.SymbolFlags.Transient) && (symbol.escapedName === ts.InternalSymbolName.ExportEquals || symbol.escapedName === ts.InternalSymbolName.Default)) {
        // Name of "export default foo;" is "foo". Name of "export default 0" is the filename converted to camelCase.

        if (!symbol.declarations)
            return undefined;

        for (let d of symbol.declarations) {
            if (isExportAssignment(d)) {
                let expr = skipOuterExpressions(d.expression);
                if (ts.isIdentifier(expr))
                    return expr.text;

                let x = moduleSymbolToValidIdentifier(getSymbolParentOrFail(symbol), scriptTarget);
                if (x)
                    return x;
            } // ? tryCast(skipOuterExpressions(d.expression), isIdentifier)?.text : undefined
        }
        return undefined;
    }

    return symbol.name;
}

export function getNameForExportDefault(symbol: ts.Symbol): string | undefined {
    if (!symbol.declarations)
        return undefined;

    let firstDefined = symbol.declarations.find(x => x !== undefined);

    for (let declaration of symbol.declarations) {
        if (ts.isExportAssignment(declaration)) {
            let expr = skipOuterExpressions(declaration.expression);
            if (ts.isIdentifier(expr))
                return expr.text;
        } else if (ts.isExportSpecifier(declaration)) {
            if (declaration.name.text !== ts.InternalSymbolName.Default)
                throw new Error("Expected the specifier to be a default export");

            return declaration.propertyName && declaration.propertyName.text;
        }
    }
}
export function getDefaultLikeExportWorker(
    importingFile: ts.SourceFile, moduleSymbol: ts.Symbol,
    checker: ts.TypeChecker, compilerOptions: ts.CompilerOptions): { readonly symbol: ts.Symbol, readonly kind: ImportKind; } | undefined {
    const defaultExport = checker.tryGetMemberInModuleExports(ts.InternalSymbolName.Default, moduleSymbol);
    if (defaultExport) return { symbol: defaultExport, kind: ImportKind.Default };
    const exportEquals: ts.Symbol = (checker as any).resolveExternalModuleSymbol(moduleSymbol);
    return exportEquals === moduleSymbol ? undefined : { symbol: exportEquals, kind: getExportEqualsImportKind(importingFile, compilerOptions) };
}

export function getExportEqualsImportKind(importingFile: ts.SourceFile, compilerOptions: ts.CompilerOptions): ImportKind {
    const allowSyntheticDefaults = getAllowSyntheticDefaultImports(compilerOptions);
    // 1. 'import =' will not work in es2015+, so the decision is between a default
    //    and a namespace import, based on allowSyntheticDefaultImports/esModuleInterop.
    if (getEmitModuleKind(compilerOptions) >= ts.ModuleKind.ES2015) {
        return allowSyntheticDefaults ? ImportKind.Default : ImportKind.Namespace;
    }
    // 2. 'import =' will not work in JavaScript, so the decision is between a default
    //    and const/require.
    if (isInJSFile(importingFile)) {
        return isExternalModule(importingFile) ? ImportKind.Default : ImportKind.CommonJS;
    }
    // 3. At this point the most correct choice is probably 'import =', but people
    //    really hate that, so look to see if the importing file has any precedent
    //    on how to handle it.
    for (const statement of importingFile.statements) {
        if (statement.kind === ts.SyntaxKind.ImportEqualsDeclaration) {
            return ImportKind.CommonJS;
        }
    }
    // 4. We have no precedent to go on, so just use a default import if
    //    allowSyntheticDefaultImports/esModuleInterop is enabled.
    return allowSyntheticDefaults ? ImportKind.Default : ImportKind.CommonJS;
}

export function getEmitModuleKind(compilerOptions: { module?: ts.CompilerOptions["module"], target?: ts.CompilerOptions["target"]; }) {
    return typeof compilerOptions.module === "number" ?
        compilerOptions.module :
        getEmitScriptTarget(compilerOptions) >= ts.ScriptTarget.ES2015 ? ts.ModuleKind.ES2015 : ts.ModuleKind.CommonJS;
}

export function getEmitScriptTarget(compilerOptions: ts.CompilerOptions) {
    return compilerOptions.target || ts.ScriptTarget.ES3;
}

export function getAllowSyntheticDefaultImports(compilerOptions: ts.CompilerOptions) {
    const moduleKind = getEmitModuleKind(compilerOptions);
    return compilerOptions.allowSyntheticDefaultImports !== undefined
        ? compilerOptions.allowSyntheticDefaultImports
        : compilerOptions.esModuleInterop ||
        moduleKind === ts.ModuleKind.System;
}

export function isInJSFile(node: ts.Node | undefined): boolean {
    return !!node && !!(node.flags & ts.NodeFlags.JavaScriptFile);
}

export function isExternalModule(file: ts.SourceFile): boolean {
    return (file as any).externalModuleIndicator !== undefined;
}

export function getLocalSymbolForExportDefault(symbol: ts.Symbol) {
    if (!isExportDefaultSymbol(symbol)) return undefined;
    if (!symbol.declarations)
        return undefined;

    for (const decl of symbol.declarations) {
        if ((decl as any).localSymbol) return (decl as any).localSymbol;
    }
    return undefined;
}

export function isExportDefaultSymbol(symbol: ts.Symbol): boolean {
    if (!symbol.declarations)
        return false;
    return symbol && (symbol.declarations?.length ?? 0) > 0 && hasModifier(ts.canHaveModifiers(symbol.declarations[0]) ? ts.getModifiers(symbol.declarations[0]) : [], ts.SyntaxKind.DefaultKeyword);
}

export function skipOuterExpressions(node: ts.Expression, kinds?: ts.OuterExpressionKinds): ts.Expression;
export function skipOuterExpressions(node: ts.Node, kinds?: ts.OuterExpressionKinds): ts.Node;
export function skipOuterExpressions(node: ts.Node, kinds = ts.OuterExpressionKinds.All) {
    while (isOuterExpression(node, kinds)) {
        node = node.expression;
    }
    return node;
}

export function isOuterExpression(node: ts.Node, kinds = ts.OuterExpressionKinds.All): node is OuterExpression {
    switch (node.kind) {
        case ts.SyntaxKind.ParenthesizedExpression:
            return (kinds & ts.OuterExpressionKinds.Parentheses) !== 0;
        case ts.SyntaxKind.TypeAssertionExpression:
        case ts.SyntaxKind.AsExpression:
            return (kinds & ts.OuterExpressionKinds.TypeAssertions) !== 0;
        case ts.SyntaxKind.NonNullExpression:
            return (kinds & ts.OuterExpressionKinds.NonNullAssertions) !== 0;
        case ts.SyntaxKind.PartiallyEmittedExpression:
            return (kinds & ts.OuterExpressionKinds.PartiallyEmittedExpressions) !== 0;
    }
    return false;
}

export function isExportAssignment(node: ts.Node): node is ts.ExportAssignment {
    return node.kind === ts.SyntaxKind.ExportAssignment;
}

export type OuterExpression =
    | ts.ParenthesizedExpression
    | ts.TypeAssertion
    | ts.AsExpression
    | ts.NonNullExpression
    | ts.PartiallyEmittedExpression;

export function moduleSymbolToValidIdentifier(moduleSymbol: ts.Symbol, target: ts.ScriptTarget | undefined): string {
    return moduleSpecifierToValidIdentifier(removeFileExtension(stripQuotes(moduleSymbol.name)), target);
}

export function removeSuffix(str: string, suffix: string): string {
    return str.endsWith(suffix) ? str.slice(0, str.length - suffix.length) : str;
}

export function getRttiDocTagFromNode(element: ts.Node, tagName: string): string {
    let tags = ts.getJSDocTags(element);
    if (!tags)
        return undefined;

    let match = tags
        .find(x => x.tagName.text === 'rtti' && typeof x.comment === 'string' && (x.comment.startsWith(`:${tagName} `) || x.comment === `:${tagName}`));

    if (!match)
        return undefined;

    return (match.comment as string).slice(`:${tagName} `.length);
}

export function getRttiDocTagFromSignature(signature: ts.Signature, tagName: string): string {
    let jsDocTags = signature.getJsDocTags();
    if (!jsDocTags)
        return undefined;

    let tag = jsDocTags.find(x => x.name === 'rtti' && x.text[0]?.text.startsWith(`:${tagName} `));
    if (!tag)
        return undefined;

    let comment = <string>tag.text[0].text;
    let value = comment.slice(`:${tagName} `.length);

    return value;
}

/*
    As per ECMAScript Language Specification 3th Edition, Section 7.6: Identifiers
    IdentifierStart ::
        Can contain Unicode 3.0.0 categories:
        Uppercase letter (Lu),
        Lowercase letter (Ll),
        Titlecase letter (Lt),
        Modifier letter (Lm),
        Other letter (Lo), or
        Letter number (Nl).
    IdentifierPart :: =
        Can contain IdentifierStart + Unicode 3.0.0 categories:
        Non-spacing mark (Mn),
        Combining spacing mark (Mc),
        Decimal number (Nd), or
        Connector punctuation (Pc).

    Codepoint ranges for ES3 Identifiers are extracted from the Unicode 3.0.0 specification at:
    http://www.unicode.org/Public/3.0-Update/UnicodeData-3.0.0.txt
*/
const unicodeES3IdentifierStart = [170, 170, 181, 181, 186, 186, 192, 214, 216, 246, 248, 543, 546, 563, 592, 685, 688, 696, 699, 705, 720, 721, 736, 740, 750, 750, 890, 890, 902, 902, 904, 906, 908, 908, 910, 929, 931, 974, 976, 983, 986, 1011, 1024, 1153, 1164, 1220, 1223, 1224, 1227, 1228, 1232, 1269, 1272, 1273, 1329, 1366, 1369, 1369, 1377, 1415, 1488, 1514, 1520, 1522, 1569, 1594, 1600, 1610, 1649, 1747, 1749, 1749, 1765, 1766, 1786, 1788, 1808, 1808, 1810, 1836, 1920, 1957, 2309, 2361, 2365, 2365, 2384, 2384, 2392, 2401, 2437, 2444, 2447, 2448, 2451, 2472, 2474, 2480, 2482, 2482, 2486, 2489, 2524, 2525, 2527, 2529, 2544, 2545, 2565, 2570, 2575, 2576, 2579, 2600, 2602, 2608, 2610, 2611, 2613, 2614, 2616, 2617, 2649, 2652, 2654, 2654, 2674, 2676, 2693, 2699, 2701, 2701, 2703, 2705, 2707, 2728, 2730, 2736, 2738, 2739, 2741, 2745, 2749, 2749, 2768, 2768, 2784, 2784, 2821, 2828, 2831, 2832, 2835, 2856, 2858, 2864, 2866, 2867, 2870, 2873, 2877, 2877, 2908, 2909, 2911, 2913, 2949, 2954, 2958, 2960, 2962, 2965, 2969, 2970, 2972, 2972, 2974, 2975, 2979, 2980, 2984, 2986, 2990, 2997, 2999, 3001, 3077, 3084, 3086, 3088, 3090, 3112, 3114, 3123, 3125, 3129, 3168, 3169, 3205, 3212, 3214, 3216, 3218, 3240, 3242, 3251, 3253, 3257, 3294, 3294, 3296, 3297, 3333, 3340, 3342, 3344, 3346, 3368, 3370, 3385, 3424, 3425, 3461, 3478, 3482, 3505, 3507, 3515, 3517, 3517, 3520, 3526, 3585, 3632, 3634, 3635, 3648, 3654, 3713, 3714, 3716, 3716, 3719, 3720, 3722, 3722, 3725, 3725, 3732, 3735, 3737, 3743, 3745, 3747, 3749, 3749, 3751, 3751, 3754, 3755, 3757, 3760, 3762, 3763, 3773, 3773, 3776, 3780, 3782, 3782, 3804, 3805, 3840, 3840, 3904, 3911, 3913, 3946, 3976, 3979, 4096, 4129, 4131, 4135, 4137, 4138, 4176, 4181, 4256, 4293, 4304, 4342, 4352, 4441, 4447, 4514, 4520, 4601, 4608, 4614, 4616, 4678, 4680, 4680, 4682, 4685, 4688, 4694, 4696, 4696, 4698, 4701, 4704, 4742, 4744, 4744, 4746, 4749, 4752, 4782, 4784, 4784, 4786, 4789, 4792, 4798, 4800, 4800, 4802, 4805, 4808, 4814, 4816, 4822, 4824, 4846, 4848, 4878, 4880, 4880, 4882, 4885, 4888, 4894, 4896, 4934, 4936, 4954, 5024, 5108, 5121, 5740, 5743, 5750, 5761, 5786, 5792, 5866, 6016, 6067, 6176, 6263, 6272, 6312, 7680, 7835, 7840, 7929, 7936, 7957, 7960, 7965, 7968, 8005, 8008, 8013, 8016, 8023, 8025, 8025, 8027, 8027, 8029, 8029, 8031, 8061, 8064, 8116, 8118, 8124, 8126, 8126, 8130, 8132, 8134, 8140, 8144, 8147, 8150, 8155, 8160, 8172, 8178, 8180, 8182, 8188, 8319, 8319, 8450, 8450, 8455, 8455, 8458, 8467, 8469, 8469, 8473, 8477, 8484, 8484, 8486, 8486, 8488, 8488, 8490, 8493, 8495, 8497, 8499, 8505, 8544, 8579, 12293, 12295, 12321, 12329, 12337, 12341, 12344, 12346, 12353, 12436, 12445, 12446, 12449, 12538, 12540, 12542, 12549, 12588, 12593, 12686, 12704, 12727, 13312, 19893, 19968, 40869, 40960, 42124, 44032, 55203, 63744, 64045, 64256, 64262, 64275, 64279, 64285, 64285, 64287, 64296, 64298, 64310, 64312, 64316, 64318, 64318, 64320, 64321, 64323, 64324, 64326, 64433, 64467, 64829, 64848, 64911, 64914, 64967, 65008, 65019, 65136, 65138, 65140, 65140, 65142, 65276, 65313, 65338, 65345, 65370, 65382, 65470, 65474, 65479, 65482, 65487, 65490, 65495, 65498, 65500,];
const unicodeES3IdentifierPart = [170, 170, 181, 181, 186, 186, 192, 214, 216, 246, 248, 543, 546, 563, 592, 685, 688, 696, 699, 705, 720, 721, 736, 740, 750, 750, 768, 846, 864, 866, 890, 890, 902, 902, 904, 906, 908, 908, 910, 929, 931, 974, 976, 983, 986, 1011, 1024, 1153, 1155, 1158, 1164, 1220, 1223, 1224, 1227, 1228, 1232, 1269, 1272, 1273, 1329, 1366, 1369, 1369, 1377, 1415, 1425, 1441, 1443, 1465, 1467, 1469, 1471, 1471, 1473, 1474, 1476, 1476, 1488, 1514, 1520, 1522, 1569, 1594, 1600, 1621, 1632, 1641, 1648, 1747, 1749, 1756, 1759, 1768, 1770, 1773, 1776, 1788, 1808, 1836, 1840, 1866, 1920, 1968, 2305, 2307, 2309, 2361, 2364, 2381, 2384, 2388, 2392, 2403, 2406, 2415, 2433, 2435, 2437, 2444, 2447, 2448, 2451, 2472, 2474, 2480, 2482, 2482, 2486, 2489, 2492, 2492, 2494, 2500, 2503, 2504, 2507, 2509, 2519, 2519, 2524, 2525, 2527, 2531, 2534, 2545, 2562, 2562, 2565, 2570, 2575, 2576, 2579, 2600, 2602, 2608, 2610, 2611, 2613, 2614, 2616, 2617, 2620, 2620, 2622, 2626, 2631, 2632, 2635, 2637, 2649, 2652, 2654, 2654, 2662, 2676, 2689, 2691, 2693, 2699, 2701, 2701, 2703, 2705, 2707, 2728, 2730, 2736, 2738, 2739, 2741, 2745, 2748, 2757, 2759, 2761, 2763, 2765, 2768, 2768, 2784, 2784, 2790, 2799, 2817, 2819, 2821, 2828, 2831, 2832, 2835, 2856, 2858, 2864, 2866, 2867, 2870, 2873, 2876, 2883, 2887, 2888, 2891, 2893, 2902, 2903, 2908, 2909, 2911, 2913, 2918, 2927, 2946, 2947, 2949, 2954, 2958, 2960, 2962, 2965, 2969, 2970, 2972, 2972, 2974, 2975, 2979, 2980, 2984, 2986, 2990, 2997, 2999, 3001, 3006, 3010, 3014, 3016, 3018, 3021, 3031, 3031, 3047, 3055, 3073, 3075, 3077, 3084, 3086, 3088, 3090, 3112, 3114, 3123, 3125, 3129, 3134, 3140, 3142, 3144, 3146, 3149, 3157, 3158, 3168, 3169, 3174, 3183, 3202, 3203, 3205, 3212, 3214, 3216, 3218, 3240, 3242, 3251, 3253, 3257, 3262, 3268, 3270, 3272, 3274, 3277, 3285, 3286, 3294, 3294, 3296, 3297, 3302, 3311, 3330, 3331, 3333, 3340, 3342, 3344, 3346, 3368, 3370, 3385, 3390, 3395, 3398, 3400, 3402, 3405, 3415, 3415, 3424, 3425, 3430, 3439, 3458, 3459, 3461, 3478, 3482, 3505, 3507, 3515, 3517, 3517, 3520, 3526, 3530, 3530, 3535, 3540, 3542, 3542, 3544, 3551, 3570, 3571, 3585, 3642, 3648, 3662, 3664, 3673, 3713, 3714, 3716, 3716, 3719, 3720, 3722, 3722, 3725, 3725, 3732, 3735, 3737, 3743, 3745, 3747, 3749, 3749, 3751, 3751, 3754, 3755, 3757, 3769, 3771, 3773, 3776, 3780, 3782, 3782, 3784, 3789, 3792, 3801, 3804, 3805, 3840, 3840, 3864, 3865, 3872, 3881, 3893, 3893, 3895, 3895, 3897, 3897, 3902, 3911, 3913, 3946, 3953, 3972, 3974, 3979, 3984, 3991, 3993, 4028, 4038, 4038, 4096, 4129, 4131, 4135, 4137, 4138, 4140, 4146, 4150, 4153, 4160, 4169, 4176, 4185, 4256, 4293, 4304, 4342, 4352, 4441, 4447, 4514, 4520, 4601, 4608, 4614, 4616, 4678, 4680, 4680, 4682, 4685, 4688, 4694, 4696, 4696, 4698, 4701, 4704, 4742, 4744, 4744, 4746, 4749, 4752, 4782, 4784, 4784, 4786, 4789, 4792, 4798, 4800, 4800, 4802, 4805, 4808, 4814, 4816, 4822, 4824, 4846, 4848, 4878, 4880, 4880, 4882, 4885, 4888, 4894, 4896, 4934, 4936, 4954, 4969, 4977, 5024, 5108, 5121, 5740, 5743, 5750, 5761, 5786, 5792, 5866, 6016, 6099, 6112, 6121, 6160, 6169, 6176, 6263, 6272, 6313, 7680, 7835, 7840, 7929, 7936, 7957, 7960, 7965, 7968, 8005, 8008, 8013, 8016, 8023, 8025, 8025, 8027, 8027, 8029, 8029, 8031, 8061, 8064, 8116, 8118, 8124, 8126, 8126, 8130, 8132, 8134, 8140, 8144, 8147, 8150, 8155, 8160, 8172, 8178, 8180, 8182, 8188, 8255, 8256, 8319, 8319, 8400, 8412, 8417, 8417, 8450, 8450, 8455, 8455, 8458, 8467, 8469, 8469, 8473, 8477, 8484, 8484, 8486, 8486, 8488, 8488, 8490, 8493, 8495, 8497, 8499, 8505, 8544, 8579, 12293, 12295, 12321, 12335, 12337, 12341, 12344, 12346, 12353, 12436, 12441, 12442, 12445, 12446, 12449, 12542, 12549, 12588, 12593, 12686, 12704, 12727, 13312, 19893, 19968, 40869, 40960, 42124, 44032, 55203, 63744, 64045, 64256, 64262, 64275, 64279, 64285, 64296, 64298, 64310, 64312, 64316, 64318, 64318, 64320, 64321, 64323, 64324, 64326, 64433, 64467, 64829, 64848, 64911, 64914, 64967, 65008, 65019, 65056, 65059, 65075, 65076, 65101, 65103, 65136, 65138, 65140, 65140, 65142, 65276, 65296, 65305, 65313, 65338, 65343, 65343, 65345, 65370, 65381, 65470, 65474, 65479, 65482, 65487, 65490, 65495, 65498, 65500,];

/*
    As per ECMAScript Language Specification 5th Edition, Section 7.6: ISyntaxToken Names and Identifiers
    IdentifierStart ::
        Can contain Unicode 6.2 categories:
        Uppercase letter (Lu),
        Lowercase letter (Ll),
        Titlecase letter (Lt),
        Modifier letter (Lm),
        Other letter (Lo), or
        Letter number (Nl).
    IdentifierPart ::
        Can contain IdentifierStart + Unicode 6.2 categories:
        Non-spacing mark (Mn),
        Combining spacing mark (Mc),
        Decimal number (Nd),
        Connector punctuation (Pc),
        <ZWNJ>, or
        <ZWJ>.

    Codepoint ranges for ES5 Identifiers are extracted from the Unicode 6.2 specification at:
    http://www.unicode.org/Public/6.2.0/ucd/UnicodeData.txt
*/
const unicodeES5IdentifierStart = [170, 170, 181, 181, 186, 186, 192, 214, 216, 246, 248, 705, 710, 721, 736, 740, 748, 748, 750, 750, 880, 884, 886, 887, 890, 893, 902, 902, 904, 906, 908, 908, 910, 929, 931, 1013, 1015, 1153, 1162, 1319, 1329, 1366, 1369, 1369, 1377, 1415, 1488, 1514, 1520, 1522, 1568, 1610, 1646, 1647, 1649, 1747, 1749, 1749, 1765, 1766, 1774, 1775, 1786, 1788, 1791, 1791, 1808, 1808, 1810, 1839, 1869, 1957, 1969, 1969, 1994, 2026, 2036, 2037, 2042, 2042, 2048, 2069, 2074, 2074, 2084, 2084, 2088, 2088, 2112, 2136, 2208, 2208, 2210, 2220, 2308, 2361, 2365, 2365, 2384, 2384, 2392, 2401, 2417, 2423, 2425, 2431, 2437, 2444, 2447, 2448, 2451, 2472, 2474, 2480, 2482, 2482, 2486, 2489, 2493, 2493, 2510, 2510, 2524, 2525, 2527, 2529, 2544, 2545, 2565, 2570, 2575, 2576, 2579, 2600, 2602, 2608, 2610, 2611, 2613, 2614, 2616, 2617, 2649, 2652, 2654, 2654, 2674, 2676, 2693, 2701, 2703, 2705, 2707, 2728, 2730, 2736, 2738, 2739, 2741, 2745, 2749, 2749, 2768, 2768, 2784, 2785, 2821, 2828, 2831, 2832, 2835, 2856, 2858, 2864, 2866, 2867, 2869, 2873, 2877, 2877, 2908, 2909, 2911, 2913, 2929, 2929, 2947, 2947, 2949, 2954, 2958, 2960, 2962, 2965, 2969, 2970, 2972, 2972, 2974, 2975, 2979, 2980, 2984, 2986, 2990, 3001, 3024, 3024, 3077, 3084, 3086, 3088, 3090, 3112, 3114, 3123, 3125, 3129, 3133, 3133, 3160, 3161, 3168, 3169, 3205, 3212, 3214, 3216, 3218, 3240, 3242, 3251, 3253, 3257, 3261, 3261, 3294, 3294, 3296, 3297, 3313, 3314, 3333, 3340, 3342, 3344, 3346, 3386, 3389, 3389, 3406, 3406, 3424, 3425, 3450, 3455, 3461, 3478, 3482, 3505, 3507, 3515, 3517, 3517, 3520, 3526, 3585, 3632, 3634, 3635, 3648, 3654, 3713, 3714, 3716, 3716, 3719, 3720, 3722, 3722, 3725, 3725, 3732, 3735, 3737, 3743, 3745, 3747, 3749, 3749, 3751, 3751, 3754, 3755, 3757, 3760, 3762, 3763, 3773, 3773, 3776, 3780, 3782, 3782, 3804, 3807, 3840, 3840, 3904, 3911, 3913, 3948, 3976, 3980, 4096, 4138, 4159, 4159, 4176, 4181, 4186, 4189, 4193, 4193, 4197, 4198, 4206, 4208, 4213, 4225, 4238, 4238, 4256, 4293, 4295, 4295, 4301, 4301, 4304, 4346, 4348, 4680, 4682, 4685, 4688, 4694, 4696, 4696, 4698, 4701, 4704, 4744, 4746, 4749, 4752, 4784, 4786, 4789, 4792, 4798, 4800, 4800, 4802, 4805, 4808, 4822, 4824, 4880, 4882, 4885, 4888, 4954, 4992, 5007, 5024, 5108, 5121, 5740, 5743, 5759, 5761, 5786, 5792, 5866, 5870, 5872, 5888, 5900, 5902, 5905, 5920, 5937, 5952, 5969, 5984, 5996, 5998, 6000, 6016, 6067, 6103, 6103, 6108, 6108, 6176, 6263, 6272, 6312, 6314, 6314, 6320, 6389, 6400, 6428, 6480, 6509, 6512, 6516, 6528, 6571, 6593, 6599, 6656, 6678, 6688, 6740, 6823, 6823, 6917, 6963, 6981, 6987, 7043, 7072, 7086, 7087, 7098, 7141, 7168, 7203, 7245, 7247, 7258, 7293, 7401, 7404, 7406, 7409, 7413, 7414, 7424, 7615, 7680, 7957, 7960, 7965, 7968, 8005, 8008, 8013, 8016, 8023, 8025, 8025, 8027, 8027, 8029, 8029, 8031, 8061, 8064, 8116, 8118, 8124, 8126, 8126, 8130, 8132, 8134, 8140, 8144, 8147, 8150, 8155, 8160, 8172, 8178, 8180, 8182, 8188, 8305, 8305, 8319, 8319, 8336, 8348, 8450, 8450, 8455, 8455, 8458, 8467, 8469, 8469, 8473, 8477, 8484, 8484, 8486, 8486, 8488, 8488, 8490, 8493, 8495, 8505, 8508, 8511, 8517, 8521, 8526, 8526, 8544, 8584, 11264, 11310, 11312, 11358, 11360, 11492, 11499, 11502, 11506, 11507, 11520, 11557, 11559, 11559, 11565, 11565, 11568, 11623, 11631, 11631, 11648, 11670, 11680, 11686, 11688, 11694, 11696, 11702, 11704, 11710, 11712, 11718, 11720, 11726, 11728, 11734, 11736, 11742, 11823, 11823, 12293, 12295, 12321, 12329, 12337, 12341, 12344, 12348, 12353, 12438, 12445, 12447, 12449, 12538, 12540, 12543, 12549, 12589, 12593, 12686, 12704, 12730, 12784, 12799, 13312, 19893, 19968, 40908, 40960, 42124, 42192, 42237, 42240, 42508, 42512, 42527, 42538, 42539, 42560, 42606, 42623, 42647, 42656, 42735, 42775, 42783, 42786, 42888, 42891, 42894, 42896, 42899, 42912, 42922, 43000, 43009, 43011, 43013, 43015, 43018, 43020, 43042, 43072, 43123, 43138, 43187, 43250, 43255, 43259, 43259, 43274, 43301, 43312, 43334, 43360, 43388, 43396, 43442, 43471, 43471, 43520, 43560, 43584, 43586, 43588, 43595, 43616, 43638, 43642, 43642, 43648, 43695, 43697, 43697, 43701, 43702, 43705, 43709, 43712, 43712, 43714, 43714, 43739, 43741, 43744, 43754, 43762, 43764, 43777, 43782, 43785, 43790, 43793, 43798, 43808, 43814, 43816, 43822, 43968, 44002, 44032, 55203, 55216, 55238, 55243, 55291, 63744, 64109, 64112, 64217, 64256, 64262, 64275, 64279, 64285, 64285, 64287, 64296, 64298, 64310, 64312, 64316, 64318, 64318, 64320, 64321, 64323, 64324, 64326, 64433, 64467, 64829, 64848, 64911, 64914, 64967, 65008, 65019, 65136, 65140, 65142, 65276, 65313, 65338, 65345, 65370, 65382, 65470, 65474, 65479, 65482, 65487, 65490, 65495, 65498, 65500,];
const unicodeES5IdentifierPart = [170, 170, 181, 181, 186, 186, 192, 214, 216, 246, 248, 705, 710, 721, 736, 740, 748, 748, 750, 750, 768, 884, 886, 887, 890, 893, 902, 902, 904, 906, 908, 908, 910, 929, 931, 1013, 1015, 1153, 1155, 1159, 1162, 1319, 1329, 1366, 1369, 1369, 1377, 1415, 1425, 1469, 1471, 1471, 1473, 1474, 1476, 1477, 1479, 1479, 1488, 1514, 1520, 1522, 1552, 1562, 1568, 1641, 1646, 1747, 1749, 1756, 1759, 1768, 1770, 1788, 1791, 1791, 1808, 1866, 1869, 1969, 1984, 2037, 2042, 2042, 2048, 2093, 2112, 2139, 2208, 2208, 2210, 2220, 2276, 2302, 2304, 2403, 2406, 2415, 2417, 2423, 2425, 2431, 2433, 2435, 2437, 2444, 2447, 2448, 2451, 2472, 2474, 2480, 2482, 2482, 2486, 2489, 2492, 2500, 2503, 2504, 2507, 2510, 2519, 2519, 2524, 2525, 2527, 2531, 2534, 2545, 2561, 2563, 2565, 2570, 2575, 2576, 2579, 2600, 2602, 2608, 2610, 2611, 2613, 2614, 2616, 2617, 2620, 2620, 2622, 2626, 2631, 2632, 2635, 2637, 2641, 2641, 2649, 2652, 2654, 2654, 2662, 2677, 2689, 2691, 2693, 2701, 2703, 2705, 2707, 2728, 2730, 2736, 2738, 2739, 2741, 2745, 2748, 2757, 2759, 2761, 2763, 2765, 2768, 2768, 2784, 2787, 2790, 2799, 2817, 2819, 2821, 2828, 2831, 2832, 2835, 2856, 2858, 2864, 2866, 2867, 2869, 2873, 2876, 2884, 2887, 2888, 2891, 2893, 2902, 2903, 2908, 2909, 2911, 2915, 2918, 2927, 2929, 2929, 2946, 2947, 2949, 2954, 2958, 2960, 2962, 2965, 2969, 2970, 2972, 2972, 2974, 2975, 2979, 2980, 2984, 2986, 2990, 3001, 3006, 3010, 3014, 3016, 3018, 3021, 3024, 3024, 3031, 3031, 3046, 3055, 3073, 3075, 3077, 3084, 3086, 3088, 3090, 3112, 3114, 3123, 3125, 3129, 3133, 3140, 3142, 3144, 3146, 3149, 3157, 3158, 3160, 3161, 3168, 3171, 3174, 3183, 3202, 3203, 3205, 3212, 3214, 3216, 3218, 3240, 3242, 3251, 3253, 3257, 3260, 3268, 3270, 3272, 3274, 3277, 3285, 3286, 3294, 3294, 3296, 3299, 3302, 3311, 3313, 3314, 3330, 3331, 3333, 3340, 3342, 3344, 3346, 3386, 3389, 3396, 3398, 3400, 3402, 3406, 3415, 3415, 3424, 3427, 3430, 3439, 3450, 3455, 3458, 3459, 3461, 3478, 3482, 3505, 3507, 3515, 3517, 3517, 3520, 3526, 3530, 3530, 3535, 3540, 3542, 3542, 3544, 3551, 3570, 3571, 3585, 3642, 3648, 3662, 3664, 3673, 3713, 3714, 3716, 3716, 3719, 3720, 3722, 3722, 3725, 3725, 3732, 3735, 3737, 3743, 3745, 3747, 3749, 3749, 3751, 3751, 3754, 3755, 3757, 3769, 3771, 3773, 3776, 3780, 3782, 3782, 3784, 3789, 3792, 3801, 3804, 3807, 3840, 3840, 3864, 3865, 3872, 3881, 3893, 3893, 3895, 3895, 3897, 3897, 3902, 3911, 3913, 3948, 3953, 3972, 3974, 3991, 3993, 4028, 4038, 4038, 4096, 4169, 4176, 4253, 4256, 4293, 4295, 4295, 4301, 4301, 4304, 4346, 4348, 4680, 4682, 4685, 4688, 4694, 4696, 4696, 4698, 4701, 4704, 4744, 4746, 4749, 4752, 4784, 4786, 4789, 4792, 4798, 4800, 4800, 4802, 4805, 4808, 4822, 4824, 4880, 4882, 4885, 4888, 4954, 4957, 4959, 4992, 5007, 5024, 5108, 5121, 5740, 5743, 5759, 5761, 5786, 5792, 5866, 5870, 5872, 5888, 5900, 5902, 5908, 5920, 5940, 5952, 5971, 5984, 5996, 5998, 6000, 6002, 6003, 6016, 6099, 6103, 6103, 6108, 6109, 6112, 6121, 6155, 6157, 6160, 6169, 6176, 6263, 6272, 6314, 6320, 6389, 6400, 6428, 6432, 6443, 6448, 6459, 6470, 6509, 6512, 6516, 6528, 6571, 6576, 6601, 6608, 6617, 6656, 6683, 6688, 6750, 6752, 6780, 6783, 6793, 6800, 6809, 6823, 6823, 6912, 6987, 6992, 7001, 7019, 7027, 7040, 7155, 7168, 7223, 7232, 7241, 7245, 7293, 7376, 7378, 7380, 7414, 7424, 7654, 7676, 7957, 7960, 7965, 7968, 8005, 8008, 8013, 8016, 8023, 8025, 8025, 8027, 8027, 8029, 8029, 8031, 8061, 8064, 8116, 8118, 8124, 8126, 8126, 8130, 8132, 8134, 8140, 8144, 8147, 8150, 8155, 8160, 8172, 8178, 8180, 8182, 8188, 8204, 8205, 8255, 8256, 8276, 8276, 8305, 8305, 8319, 8319, 8336, 8348, 8400, 8412, 8417, 8417, 8421, 8432, 8450, 8450, 8455, 8455, 8458, 8467, 8469, 8469, 8473, 8477, 8484, 8484, 8486, 8486, 8488, 8488, 8490, 8493, 8495, 8505, 8508, 8511, 8517, 8521, 8526, 8526, 8544, 8584, 11264, 11310, 11312, 11358, 11360, 11492, 11499, 11507, 11520, 11557, 11559, 11559, 11565, 11565, 11568, 11623, 11631, 11631, 11647, 11670, 11680, 11686, 11688, 11694, 11696, 11702, 11704, 11710, 11712, 11718, 11720, 11726, 11728, 11734, 11736, 11742, 11744, 11775, 11823, 11823, 12293, 12295, 12321, 12335, 12337, 12341, 12344, 12348, 12353, 12438, 12441, 12442, 12445, 12447, 12449, 12538, 12540, 12543, 12549, 12589, 12593, 12686, 12704, 12730, 12784, 12799, 13312, 19893, 19968, 40908, 40960, 42124, 42192, 42237, 42240, 42508, 42512, 42539, 42560, 42607, 42612, 42621, 42623, 42647, 42655, 42737, 42775, 42783, 42786, 42888, 42891, 42894, 42896, 42899, 42912, 42922, 43000, 43047, 43072, 43123, 43136, 43204, 43216, 43225, 43232, 43255, 43259, 43259, 43264, 43309, 43312, 43347, 43360, 43388, 43392, 43456, 43471, 43481, 43520, 43574, 43584, 43597, 43600, 43609, 43616, 43638, 43642, 43643, 43648, 43714, 43739, 43741, 43744, 43759, 43762, 43766, 43777, 43782, 43785, 43790, 43793, 43798, 43808, 43814, 43816, 43822, 43968, 44010, 44012, 44013, 44016, 44025, 44032, 55203, 55216, 55238, 55243, 55291, 63744, 64109, 64112, 64217, 64256, 64262, 64275, 64279, 64285, 64296, 64298, 64310, 64312, 64316, 64318, 64318, 64320, 64321, 64323, 64324, 64326, 64433, 64467, 64829, 64848, 64911, 64914, 64967, 65008, 65019, 65024, 65039, 65056, 65062, 65075, 65076, 65101, 65103, 65136, 65140, 65142, 65276, 65296, 65305, 65313, 65338, 65343, 65343, 65345, 65370, 65382, 65470, 65474, 65479, 65482, 65487, 65490, 65495, 65498, 65500,];

/**
 * Generated by scripts/regenerate-unicode-identifier-parts.js on node v12.4.0 with unicode 12.1
 * based on http://www.unicode.org/reports/tr31/ and https://www.ecma-international.org/ecma-262/6.0/#sec-names-and-keywords
 * unicodeESNextIdentifierStart corresponds to the ID_Start and Other_ID_Start property, and
 * unicodeESNextIdentifierPart corresponds to ID_Continue, Other_ID_Continue, plus ID_Start and Other_ID_Start
 */
const unicodeESNextIdentifierStart = [65, 90, 97, 122, 170, 170, 181, 181, 186, 186, 192, 214, 216, 246, 248, 705, 710, 721, 736, 740, 748, 748, 750, 750, 880, 884, 886, 887, 890, 893, 895, 895, 902, 902, 904, 906, 908, 908, 910, 929, 931, 1013, 1015, 1153, 1162, 1327, 1329, 1366, 1369, 1369, 1376, 1416, 1488, 1514, 1519, 1522, 1568, 1610, 1646, 1647, 1649, 1747, 1749, 1749, 1765, 1766, 1774, 1775, 1786, 1788, 1791, 1791, 1808, 1808, 1810, 1839, 1869, 1957, 1969, 1969, 1994, 2026, 2036, 2037, 2042, 2042, 2048, 2069, 2074, 2074, 2084, 2084, 2088, 2088, 2112, 2136, 2144, 2154, 2208, 2228, 2230, 2237, 2308, 2361, 2365, 2365, 2384, 2384, 2392, 2401, 2417, 2432, 2437, 2444, 2447, 2448, 2451, 2472, 2474, 2480, 2482, 2482, 2486, 2489, 2493, 2493, 2510, 2510, 2524, 2525, 2527, 2529, 2544, 2545, 2556, 2556, 2565, 2570, 2575, 2576, 2579, 2600, 2602, 2608, 2610, 2611, 2613, 2614, 2616, 2617, 2649, 2652, 2654, 2654, 2674, 2676, 2693, 2701, 2703, 2705, 2707, 2728, 2730, 2736, 2738, 2739, 2741, 2745, 2749, 2749, 2768, 2768, 2784, 2785, 2809, 2809, 2821, 2828, 2831, 2832, 2835, 2856, 2858, 2864, 2866, 2867, 2869, 2873, 2877, 2877, 2908, 2909, 2911, 2913, 2929, 2929, 2947, 2947, 2949, 2954, 2958, 2960, 2962, 2965, 2969, 2970, 2972, 2972, 2974, 2975, 2979, 2980, 2984, 2986, 2990, 3001, 3024, 3024, 3077, 3084, 3086, 3088, 3090, 3112, 3114, 3129, 3133, 3133, 3160, 3162, 3168, 3169, 3200, 3200, 3205, 3212, 3214, 3216, 3218, 3240, 3242, 3251, 3253, 3257, 3261, 3261, 3294, 3294, 3296, 3297, 3313, 3314, 3333, 3340, 3342, 3344, 3346, 3386, 3389, 3389, 3406, 3406, 3412, 3414, 3423, 3425, 3450, 3455, 3461, 3478, 3482, 3505, 3507, 3515, 3517, 3517, 3520, 3526, 3585, 3632, 3634, 3635, 3648, 3654, 3713, 3714, 3716, 3716, 3718, 3722, 3724, 3747, 3749, 3749, 3751, 3760, 3762, 3763, 3773, 3773, 3776, 3780, 3782, 3782, 3804, 3807, 3840, 3840, 3904, 3911, 3913, 3948, 3976, 3980, 4096, 4138, 4159, 4159, 4176, 4181, 4186, 4189, 4193, 4193, 4197, 4198, 4206, 4208, 4213, 4225, 4238, 4238, 4256, 4293, 4295, 4295, 4301, 4301, 4304, 4346, 4348, 4680, 4682, 4685, 4688, 4694, 4696, 4696, 4698, 4701, 4704, 4744, 4746, 4749, 4752, 4784, 4786, 4789, 4792, 4798, 4800, 4800, 4802, 4805, 4808, 4822, 4824, 4880, 4882, 4885, 4888, 4954, 4992, 5007, 5024, 5109, 5112, 5117, 5121, 5740, 5743, 5759, 5761, 5786, 5792, 5866, 5870, 5880, 5888, 5900, 5902, 5905, 5920, 5937, 5952, 5969, 5984, 5996, 5998, 6000, 6016, 6067, 6103, 6103, 6108, 6108, 6176, 6264, 6272, 6312, 6314, 6314, 6320, 6389, 6400, 6430, 6480, 6509, 6512, 6516, 6528, 6571, 6576, 6601, 6656, 6678, 6688, 6740, 6823, 6823, 6917, 6963, 6981, 6987, 7043, 7072, 7086, 7087, 7098, 7141, 7168, 7203, 7245, 7247, 7258, 7293, 7296, 7304, 7312, 7354, 7357, 7359, 7401, 7404, 7406, 7411, 7413, 7414, 7418, 7418, 7424, 7615, 7680, 7957, 7960, 7965, 7968, 8005, 8008, 8013, 8016, 8023, 8025, 8025, 8027, 8027, 8029, 8029, 8031, 8061, 8064, 8116, 8118, 8124, 8126, 8126, 8130, 8132, 8134, 8140, 8144, 8147, 8150, 8155, 8160, 8172, 8178, 8180, 8182, 8188, 8305, 8305, 8319, 8319, 8336, 8348, 8450, 8450, 8455, 8455, 8458, 8467, 8469, 8469, 8472, 8477, 8484, 8484, 8486, 8486, 8488, 8488, 8490, 8505, 8508, 8511, 8517, 8521, 8526, 8526, 8544, 8584, 11264, 11310, 11312, 11358, 11360, 11492, 11499, 11502, 11506, 11507, 11520, 11557, 11559, 11559, 11565, 11565, 11568, 11623, 11631, 11631, 11648, 11670, 11680, 11686, 11688, 11694, 11696, 11702, 11704, 11710, 11712, 11718, 11720, 11726, 11728, 11734, 11736, 11742, 12293, 12295, 12321, 12329, 12337, 12341, 12344, 12348, 12353, 12438, 12443, 12447, 12449, 12538, 12540, 12543, 12549, 12591, 12593, 12686, 12704, 12730, 12784, 12799, 13312, 19893, 19968, 40943, 40960, 42124, 42192, 42237, 42240, 42508, 42512, 42527, 42538, 42539, 42560, 42606, 42623, 42653, 42656, 42735, 42775, 42783, 42786, 42888, 42891, 42943, 42946, 42950, 42999, 43009, 43011, 43013, 43015, 43018, 43020, 43042, 43072, 43123, 43138, 43187, 43250, 43255, 43259, 43259, 43261, 43262, 43274, 43301, 43312, 43334, 43360, 43388, 43396, 43442, 43471, 43471, 43488, 43492, 43494, 43503, 43514, 43518, 43520, 43560, 43584, 43586, 43588, 43595, 43616, 43638, 43642, 43642, 43646, 43695, 43697, 43697, 43701, 43702, 43705, 43709, 43712, 43712, 43714, 43714, 43739, 43741, 43744, 43754, 43762, 43764, 43777, 43782, 43785, 43790, 43793, 43798, 43808, 43814, 43816, 43822, 43824, 43866, 43868, 43879, 43888, 44002, 44032, 55203, 55216, 55238, 55243, 55291, 63744, 64109, 64112, 64217, 64256, 64262, 64275, 64279, 64285, 64285, 64287, 64296, 64298, 64310, 64312, 64316, 64318, 64318, 64320, 64321, 64323, 64324, 64326, 64433, 64467, 64829, 64848, 64911, 64914, 64967, 65008, 65019, 65136, 65140, 65142, 65276, 65313, 65338, 65345, 65370, 65382, 65470, 65474, 65479, 65482, 65487, 65490, 65495, 65498, 65500, 65536, 65547, 65549, 65574, 65576, 65594, 65596, 65597, 65599, 65613, 65616, 65629, 65664, 65786, 65856, 65908, 66176, 66204, 66208, 66256, 66304, 66335, 66349, 66378, 66384, 66421, 66432, 66461, 66464, 66499, 66504, 66511, 66513, 66517, 66560, 66717, 66736, 66771, 66776, 66811, 66816, 66855, 66864, 66915, 67072, 67382, 67392, 67413, 67424, 67431, 67584, 67589, 67592, 67592, 67594, 67637, 67639, 67640, 67644, 67644, 67647, 67669, 67680, 67702, 67712, 67742, 67808, 67826, 67828, 67829, 67840, 67861, 67872, 67897, 67968, 68023, 68030, 68031, 68096, 68096, 68112, 68115, 68117, 68119, 68121, 68149, 68192, 68220, 68224, 68252, 68288, 68295, 68297, 68324, 68352, 68405, 68416, 68437, 68448, 68466, 68480, 68497, 68608, 68680, 68736, 68786, 68800, 68850, 68864, 68899, 69376, 69404, 69415, 69415, 69424, 69445, 69600, 69622, 69635, 69687, 69763, 69807, 69840, 69864, 69891, 69926, 69956, 69956, 69968, 70002, 70006, 70006, 70019, 70066, 70081, 70084, 70106, 70106, 70108, 70108, 70144, 70161, 70163, 70187, 70272, 70278, 70280, 70280, 70282, 70285, 70287, 70301, 70303, 70312, 70320, 70366, 70405, 70412, 70415, 70416, 70419, 70440, 70442, 70448, 70450, 70451, 70453, 70457, 70461, 70461, 70480, 70480, 70493, 70497, 70656, 70708, 70727, 70730, 70751, 70751, 70784, 70831, 70852, 70853, 70855, 70855, 71040, 71086, 71128, 71131, 71168, 71215, 71236, 71236, 71296, 71338, 71352, 71352, 71424, 71450, 71680, 71723, 71840, 71903, 71935, 71935, 72096, 72103, 72106, 72144, 72161, 72161, 72163, 72163, 72192, 72192, 72203, 72242, 72250, 72250, 72272, 72272, 72284, 72329, 72349, 72349, 72384, 72440, 72704, 72712, 72714, 72750, 72768, 72768, 72818, 72847, 72960, 72966, 72968, 72969, 72971, 73008, 73030, 73030, 73056, 73061, 73063, 73064, 73066, 73097, 73112, 73112, 73440, 73458, 73728, 74649, 74752, 74862, 74880, 75075, 77824, 78894, 82944, 83526, 92160, 92728, 92736, 92766, 92880, 92909, 92928, 92975, 92992, 92995, 93027, 93047, 93053, 93071, 93760, 93823, 93952, 94026, 94032, 94032, 94099, 94111, 94176, 94177, 94179, 94179, 94208, 100343, 100352, 101106, 110592, 110878, 110928, 110930, 110948, 110951, 110960, 111355, 113664, 113770, 113776, 113788, 113792, 113800, 113808, 113817, 119808, 119892, 119894, 119964, 119966, 119967, 119970, 119970, 119973, 119974, 119977, 119980, 119982, 119993, 119995, 119995, 119997, 120003, 120005, 120069, 120071, 120074, 120077, 120084, 120086, 120092, 120094, 120121, 120123, 120126, 120128, 120132, 120134, 120134, 120138, 120144, 120146, 120485, 120488, 120512, 120514, 120538, 120540, 120570, 120572, 120596, 120598, 120628, 120630, 120654, 120656, 120686, 120688, 120712, 120714, 120744, 120746, 120770, 120772, 120779, 123136, 123180, 123191, 123197, 123214, 123214, 123584, 123627, 124928, 125124, 125184, 125251, 125259, 125259, 126464, 126467, 126469, 126495, 126497, 126498, 126500, 126500, 126503, 126503, 126505, 126514, 126516, 126519, 126521, 126521, 126523, 126523, 126530, 126530, 126535, 126535, 126537, 126537, 126539, 126539, 126541, 126543, 126545, 126546, 126548, 126548, 126551, 126551, 126553, 126553, 126555, 126555, 126557, 126557, 126559, 126559, 126561, 126562, 126564, 126564, 126567, 126570, 126572, 126578, 126580, 126583, 126585, 126588, 126590, 126590, 126592, 126601, 126603, 126619, 126625, 126627, 126629, 126633, 126635, 126651, 131072, 173782, 173824, 177972, 177984, 178205, 178208, 183969, 183984, 191456, 194560, 195101];
const unicodeESNextIdentifierPart = [48, 57, 65, 90, 95, 95, 97, 122, 170, 170, 181, 181, 183, 183, 186, 186, 192, 214, 216, 246, 248, 705, 710, 721, 736, 740, 748, 748, 750, 750, 768, 884, 886, 887, 890, 893, 895, 895, 902, 906, 908, 908, 910, 929, 931, 1013, 1015, 1153, 1155, 1159, 1162, 1327, 1329, 1366, 1369, 1369, 1376, 1416, 1425, 1469, 1471, 1471, 1473, 1474, 1476, 1477, 1479, 1479, 1488, 1514, 1519, 1522, 1552, 1562, 1568, 1641, 1646, 1747, 1749, 1756, 1759, 1768, 1770, 1788, 1791, 1791, 1808, 1866, 1869, 1969, 1984, 2037, 2042, 2042, 2045, 2045, 2048, 2093, 2112, 2139, 2144, 2154, 2208, 2228, 2230, 2237, 2259, 2273, 2275, 2403, 2406, 2415, 2417, 2435, 2437, 2444, 2447, 2448, 2451, 2472, 2474, 2480, 2482, 2482, 2486, 2489, 2492, 2500, 2503, 2504, 2507, 2510, 2519, 2519, 2524, 2525, 2527, 2531, 2534, 2545, 2556, 2556, 2558, 2558, 2561, 2563, 2565, 2570, 2575, 2576, 2579, 2600, 2602, 2608, 2610, 2611, 2613, 2614, 2616, 2617, 2620, 2620, 2622, 2626, 2631, 2632, 2635, 2637, 2641, 2641, 2649, 2652, 2654, 2654, 2662, 2677, 2689, 2691, 2693, 2701, 2703, 2705, 2707, 2728, 2730, 2736, 2738, 2739, 2741, 2745, 2748, 2757, 2759, 2761, 2763, 2765, 2768, 2768, 2784, 2787, 2790, 2799, 2809, 2815, 2817, 2819, 2821, 2828, 2831, 2832, 2835, 2856, 2858, 2864, 2866, 2867, 2869, 2873, 2876, 2884, 2887, 2888, 2891, 2893, 2902, 2903, 2908, 2909, 2911, 2915, 2918, 2927, 2929, 2929, 2946, 2947, 2949, 2954, 2958, 2960, 2962, 2965, 2969, 2970, 2972, 2972, 2974, 2975, 2979, 2980, 2984, 2986, 2990, 3001, 3006, 3010, 3014, 3016, 3018, 3021, 3024, 3024, 3031, 3031, 3046, 3055, 3072, 3084, 3086, 3088, 3090, 3112, 3114, 3129, 3133, 3140, 3142, 3144, 3146, 3149, 3157, 3158, 3160, 3162, 3168, 3171, 3174, 3183, 3200, 3203, 3205, 3212, 3214, 3216, 3218, 3240, 3242, 3251, 3253, 3257, 3260, 3268, 3270, 3272, 3274, 3277, 3285, 3286, 3294, 3294, 3296, 3299, 3302, 3311, 3313, 3314, 3328, 3331, 3333, 3340, 3342, 3344, 3346, 3396, 3398, 3400, 3402, 3406, 3412, 3415, 3423, 3427, 3430, 3439, 3450, 3455, 3458, 3459, 3461, 3478, 3482, 3505, 3507, 3515, 3517, 3517, 3520, 3526, 3530, 3530, 3535, 3540, 3542, 3542, 3544, 3551, 3558, 3567, 3570, 3571, 3585, 3642, 3648, 3662, 3664, 3673, 3713, 3714, 3716, 3716, 3718, 3722, 3724, 3747, 3749, 3749, 3751, 3773, 3776, 3780, 3782, 3782, 3784, 3789, 3792, 3801, 3804, 3807, 3840, 3840, 3864, 3865, 3872, 3881, 3893, 3893, 3895, 3895, 3897, 3897, 3902, 3911, 3913, 3948, 3953, 3972, 3974, 3991, 3993, 4028, 4038, 4038, 4096, 4169, 4176, 4253, 4256, 4293, 4295, 4295, 4301, 4301, 4304, 4346, 4348, 4680, 4682, 4685, 4688, 4694, 4696, 4696, 4698, 4701, 4704, 4744, 4746, 4749, 4752, 4784, 4786, 4789, 4792, 4798, 4800, 4800, 4802, 4805, 4808, 4822, 4824, 4880, 4882, 4885, 4888, 4954, 4957, 4959, 4969, 4977, 4992, 5007, 5024, 5109, 5112, 5117, 5121, 5740, 5743, 5759, 5761, 5786, 5792, 5866, 5870, 5880, 5888, 5900, 5902, 5908, 5920, 5940, 5952, 5971, 5984, 5996, 5998, 6000, 6002, 6003, 6016, 6099, 6103, 6103, 6108, 6109, 6112, 6121, 6155, 6157, 6160, 6169, 6176, 6264, 6272, 6314, 6320, 6389, 6400, 6430, 6432, 6443, 6448, 6459, 6470, 6509, 6512, 6516, 6528, 6571, 6576, 6601, 6608, 6618, 6656, 6683, 6688, 6750, 6752, 6780, 6783, 6793, 6800, 6809, 6823, 6823, 6832, 6845, 6912, 6987, 6992, 7001, 7019, 7027, 7040, 7155, 7168, 7223, 7232, 7241, 7245, 7293, 7296, 7304, 7312, 7354, 7357, 7359, 7376, 7378, 7380, 7418, 7424, 7673, 7675, 7957, 7960, 7965, 7968, 8005, 8008, 8013, 8016, 8023, 8025, 8025, 8027, 8027, 8029, 8029, 8031, 8061, 8064, 8116, 8118, 8124, 8126, 8126, 8130, 8132, 8134, 8140, 8144, 8147, 8150, 8155, 8160, 8172, 8178, 8180, 8182, 8188, 8255, 8256, 8276, 8276, 8305, 8305, 8319, 8319, 8336, 8348, 8400, 8412, 8417, 8417, 8421, 8432, 8450, 8450, 8455, 8455, 8458, 8467, 8469, 8469, 8472, 8477, 8484, 8484, 8486, 8486, 8488, 8488, 8490, 8505, 8508, 8511, 8517, 8521, 8526, 8526, 8544, 8584, 11264, 11310, 11312, 11358, 11360, 11492, 11499, 11507, 11520, 11557, 11559, 11559, 11565, 11565, 11568, 11623, 11631, 11631, 11647, 11670, 11680, 11686, 11688, 11694, 11696, 11702, 11704, 11710, 11712, 11718, 11720, 11726, 11728, 11734, 11736, 11742, 11744, 11775, 12293, 12295, 12321, 12335, 12337, 12341, 12344, 12348, 12353, 12438, 12441, 12447, 12449, 12538, 12540, 12543, 12549, 12591, 12593, 12686, 12704, 12730, 12784, 12799, 13312, 19893, 19968, 40943, 40960, 42124, 42192, 42237, 42240, 42508, 42512, 42539, 42560, 42607, 42612, 42621, 42623, 42737, 42775, 42783, 42786, 42888, 42891, 42943, 42946, 42950, 42999, 43047, 43072, 43123, 43136, 43205, 43216, 43225, 43232, 43255, 43259, 43259, 43261, 43309, 43312, 43347, 43360, 43388, 43392, 43456, 43471, 43481, 43488, 43518, 43520, 43574, 43584, 43597, 43600, 43609, 43616, 43638, 43642, 43714, 43739, 43741, 43744, 43759, 43762, 43766, 43777, 43782, 43785, 43790, 43793, 43798, 43808, 43814, 43816, 43822, 43824, 43866, 43868, 43879, 43888, 44010, 44012, 44013, 44016, 44025, 44032, 55203, 55216, 55238, 55243, 55291, 63744, 64109, 64112, 64217, 64256, 64262, 64275, 64279, 64285, 64296, 64298, 64310, 64312, 64316, 64318, 64318, 64320, 64321, 64323, 64324, 64326, 64433, 64467, 64829, 64848, 64911, 64914, 64967, 65008, 65019, 65024, 65039, 65056, 65071, 65075, 65076, 65101, 65103, 65136, 65140, 65142, 65276, 65296, 65305, 65313, 65338, 65343, 65343, 65345, 65370, 65382, 65470, 65474, 65479, 65482, 65487, 65490, 65495, 65498, 65500, 65536, 65547, 65549, 65574, 65576, 65594, 65596, 65597, 65599, 65613, 65616, 65629, 65664, 65786, 65856, 65908, 66045, 66045, 66176, 66204, 66208, 66256, 66272, 66272, 66304, 66335, 66349, 66378, 66384, 66426, 66432, 66461, 66464, 66499, 66504, 66511, 66513, 66517, 66560, 66717, 66720, 66729, 66736, 66771, 66776, 66811, 66816, 66855, 66864, 66915, 67072, 67382, 67392, 67413, 67424, 67431, 67584, 67589, 67592, 67592, 67594, 67637, 67639, 67640, 67644, 67644, 67647, 67669, 67680, 67702, 67712, 67742, 67808, 67826, 67828, 67829, 67840, 67861, 67872, 67897, 67968, 68023, 68030, 68031, 68096, 68099, 68101, 68102, 68108, 68115, 68117, 68119, 68121, 68149, 68152, 68154, 68159, 68159, 68192, 68220, 68224, 68252, 68288, 68295, 68297, 68326, 68352, 68405, 68416, 68437, 68448, 68466, 68480, 68497, 68608, 68680, 68736, 68786, 68800, 68850, 68864, 68903, 68912, 68921, 69376, 69404, 69415, 69415, 69424, 69456, 69600, 69622, 69632, 69702, 69734, 69743, 69759, 69818, 69840, 69864, 69872, 69881, 69888, 69940, 69942, 69951, 69956, 69958, 69968, 70003, 70006, 70006, 70016, 70084, 70089, 70092, 70096, 70106, 70108, 70108, 70144, 70161, 70163, 70199, 70206, 70206, 70272, 70278, 70280, 70280, 70282, 70285, 70287, 70301, 70303, 70312, 70320, 70378, 70384, 70393, 70400, 70403, 70405, 70412, 70415, 70416, 70419, 70440, 70442, 70448, 70450, 70451, 70453, 70457, 70459, 70468, 70471, 70472, 70475, 70477, 70480, 70480, 70487, 70487, 70493, 70499, 70502, 70508, 70512, 70516, 70656, 70730, 70736, 70745, 70750, 70751, 70784, 70853, 70855, 70855, 70864, 70873, 71040, 71093, 71096, 71104, 71128, 71133, 71168, 71232, 71236, 71236, 71248, 71257, 71296, 71352, 71360, 71369, 71424, 71450, 71453, 71467, 71472, 71481, 71680, 71738, 71840, 71913, 71935, 71935, 72096, 72103, 72106, 72151, 72154, 72161, 72163, 72164, 72192, 72254, 72263, 72263, 72272, 72345, 72349, 72349, 72384, 72440, 72704, 72712, 72714, 72758, 72760, 72768, 72784, 72793, 72818, 72847, 72850, 72871, 72873, 72886, 72960, 72966, 72968, 72969, 72971, 73014, 73018, 73018, 73020, 73021, 73023, 73031, 73040, 73049, 73056, 73061, 73063, 73064, 73066, 73102, 73104, 73105, 73107, 73112, 73120, 73129, 73440, 73462, 73728, 74649, 74752, 74862, 74880, 75075, 77824, 78894, 82944, 83526, 92160, 92728, 92736, 92766, 92768, 92777, 92880, 92909, 92912, 92916, 92928, 92982, 92992, 92995, 93008, 93017, 93027, 93047, 93053, 93071, 93760, 93823, 93952, 94026, 94031, 94087, 94095, 94111, 94176, 94177, 94179, 94179, 94208, 100343, 100352, 101106, 110592, 110878, 110928, 110930, 110948, 110951, 110960, 111355, 113664, 113770, 113776, 113788, 113792, 113800, 113808, 113817, 113821, 113822, 119141, 119145, 119149, 119154, 119163, 119170, 119173, 119179, 119210, 119213, 119362, 119364, 119808, 119892, 119894, 119964, 119966, 119967, 119970, 119970, 119973, 119974, 119977, 119980, 119982, 119993, 119995, 119995, 119997, 120003, 120005, 120069, 120071, 120074, 120077, 120084, 120086, 120092, 120094, 120121, 120123, 120126, 120128, 120132, 120134, 120134, 120138, 120144, 120146, 120485, 120488, 120512, 120514, 120538, 120540, 120570, 120572, 120596, 120598, 120628, 120630, 120654, 120656, 120686, 120688, 120712, 120714, 120744, 120746, 120770, 120772, 120779, 120782, 120831, 121344, 121398, 121403, 121452, 121461, 121461, 121476, 121476, 121499, 121503, 121505, 121519, 122880, 122886, 122888, 122904, 122907, 122913, 122915, 122916, 122918, 122922, 123136, 123180, 123184, 123197, 123200, 123209, 123214, 123214, 123584, 123641, 124928, 125124, 125136, 125142, 125184, 125259, 125264, 125273, 126464, 126467, 126469, 126495, 126497, 126498, 126500, 126500, 126503, 126503, 126505, 126514, 126516, 126519, 126521, 126521, 126523, 126523, 126530, 126530, 126535, 126535, 126537, 126537, 126539, 126539, 126541, 126543, 126545, 126546, 126548, 126548, 126551, 126551, 126553, 126553, 126555, 126555, 126557, 126557, 126559, 126559, 126561, 126562, 126564, 126564, 126567, 126570, 126572, 126578, 126580, 126583, 126585, 126588, 126590, 126590, 126592, 126601, 126603, 126619, 126625, 126627, 126629, 126633, 126635, 126651, 131072, 173782, 173824, 177972, 177984, 178205, 178208, 183969, 183984, 191456, 194560, 195101, 917760, 917999];

export function isUnicodeIdentifierStart(code: number, languageVersion: ts.ScriptTarget | undefined) {
    return languageVersion! >= ts.ScriptTarget.ES2015 ?
        lookupInUnicodeMap(code, unicodeESNextIdentifierStart) :
        languageVersion === ts.ScriptTarget.ES5 ? lookupInUnicodeMap(code, unicodeES5IdentifierStart) :
            lookupInUnicodeMap(code, unicodeES3IdentifierStart);
}

function lookupInUnicodeMap(code: number, map: readonly number[]): boolean {
    // Bail out quickly if it couldn't possibly be in the map.
    if (code < map[0]) {
        return false;
    }

    // Perform binary search in one of the Unicode range maps
    let lo = 0;
    let hi: number = map.length;
    let mid: number;

    while (lo + 1 < hi) {
        mid = lo + (hi - lo) / 2;
        // mid has to be even to catch a range's beginning
        mid -= mid % 2;
        if (map[mid] <= code && code <= map[mid + 1]) {
            return true;
        }

        if (code < map[mid]) {
            hi = mid;
        }
        else {
            lo = mid + 2;
        }
    }

    return false;
}

export function moduleSpecifierToValidIdentifier(moduleSpecifier: string, target: ts.ScriptTarget | undefined): string {
    const baseName = getBaseFileName(removeSuffix(moduleSpecifier, "/index"));
    let res = "";
    let lastCharWasValid = true;
    const firstCharCode = baseName.charCodeAt(0);
    if (isIdentifierStart(firstCharCode, target)) {
        res += String.fromCharCode(firstCharCode);
    }
    else {
        lastCharWasValid = false;
    }
    for (let i = 1; i < baseName.length; i++) {
        const ch = baseName.charCodeAt(i);
        const isValid = isIdentifierPart(ch, target);
        if (isValid) {
            let char = String.fromCharCode(ch);
            if (!lastCharWasValid) {
                char = char.toUpperCase();
            }
            res += char;
        }
        lastCharWasValid = isValid;
    }
    // Need `|| "_"` to ensure result isn't empty.
    return !isStringANonContextualKeyword(res) ? res || "_" : `_${res}`;
}


export function isIdentifierStart(ch: number, languageVersion: ts.ScriptTarget | undefined): boolean {
    return ch >= CharacterCodes.A && ch <= CharacterCodes.Z || ch >= CharacterCodes.a && ch <= CharacterCodes.z ||
        ch === CharacterCodes.$ || ch === CharacterCodes._ ||
        ch > CharacterCodes.maxAsciiCharacter && isUnicodeIdentifierStart(ch, languageVersion);
}

export function isIdentifierPart(ch: number, languageVersion: ts.ScriptTarget | undefined, identifierVariant?: ts.LanguageVariant): boolean {
    return ch >= CharacterCodes.A && ch <= CharacterCodes.Z || ch >= CharacterCodes.a && ch <= CharacterCodes.z ||
        ch >= CharacterCodes._0 && ch <= CharacterCodes._9 || ch === CharacterCodes.$ || ch === CharacterCodes._ ||
        // "-" and ":" are valid in JSX Identifiers
        (identifierVariant === ts.LanguageVariant.JSX ? (ch === CharacterCodes.minus || ch === CharacterCodes.colon) : false) ||
        ch > CharacterCodes.maxAsciiCharacter && isUnicodeIdentifierPart(ch, languageVersion);
}

function isUnicodeIdentifierPart(code: number, languageVersion: ts.ScriptTarget | undefined) {
    return languageVersion! >= ts.ScriptTarget.ES2015 ?
        lookupInUnicodeMap(code, unicodeESNextIdentifierPart) :
        languageVersion === ts.ScriptTarget.ES5 ? lookupInUnicodeMap(code, unicodeES5IdentifierPart) :
            lookupInUnicodeMap(code, unicodeES3IdentifierPart);
}

const textToKeywordObj: MapLike<ts.KeywordSyntaxKind> = {
    abstract: ts.SyntaxKind.AbstractKeyword,
    any: ts.SyntaxKind.AnyKeyword,
    as: ts.SyntaxKind.AsKeyword,
    asserts: ts.SyntaxKind.AssertsKeyword,
    bigint: ts.SyntaxKind.BigIntKeyword,
    boolean: ts.SyntaxKind.BooleanKeyword,
    break: ts.SyntaxKind.BreakKeyword,
    case: ts.SyntaxKind.CaseKeyword,
    catch: ts.SyntaxKind.CatchKeyword,
    class: ts.SyntaxKind.ClassKeyword,
    continue: ts.SyntaxKind.ContinueKeyword,
    const: ts.SyntaxKind.ConstKeyword,
    ["" + "constructor"]: ts.SyntaxKind.ConstructorKeyword,
    debugger: ts.SyntaxKind.DebuggerKeyword,
    declare: ts.SyntaxKind.DeclareKeyword,
    default: ts.SyntaxKind.DefaultKeyword,
    delete: ts.SyntaxKind.DeleteKeyword,
    do: ts.SyntaxKind.DoKeyword,
    else: ts.SyntaxKind.ElseKeyword,
    enum: ts.SyntaxKind.EnumKeyword,
    export: ts.SyntaxKind.ExportKeyword,
    extends: ts.SyntaxKind.ExtendsKeyword,
    false: ts.SyntaxKind.FalseKeyword,
    finally: ts.SyntaxKind.FinallyKeyword,
    for: ts.SyntaxKind.ForKeyword,
    from: ts.SyntaxKind.FromKeyword,
    function: ts.SyntaxKind.FunctionKeyword,
    get: ts.SyntaxKind.GetKeyword,
    if: ts.SyntaxKind.IfKeyword,
    implements: ts.SyntaxKind.ImplementsKeyword,
    import: ts.SyntaxKind.ImportKeyword,
    in: ts.SyntaxKind.InKeyword,
    infer: ts.SyntaxKind.InferKeyword,
    instanceof: ts.SyntaxKind.InstanceOfKeyword,
    interface: ts.SyntaxKind.InterfaceKeyword,
    intrinsic: ts.SyntaxKind.IntrinsicKeyword,
    is: ts.SyntaxKind.IsKeyword,
    keyof: ts.SyntaxKind.KeyOfKeyword,
    let: ts.SyntaxKind.LetKeyword,
    module: ts.SyntaxKind.ModuleKeyword,
    namespace: ts.SyntaxKind.NamespaceKeyword,
    never: ts.SyntaxKind.NeverKeyword,
    new: ts.SyntaxKind.NewKeyword,
    null: ts.SyntaxKind.NullKeyword,
    number: ts.SyntaxKind.NumberKeyword,
    object: ts.SyntaxKind.ObjectKeyword,
    package: ts.SyntaxKind.PackageKeyword,
    private: ts.SyntaxKind.PrivateKeyword,
    protected: ts.SyntaxKind.ProtectedKeyword,
    public: ts.SyntaxKind.PublicKeyword,
    readonly: ts.SyntaxKind.ReadonlyKeyword,
    require: ts.SyntaxKind.RequireKeyword,
    global: ts.SyntaxKind.GlobalKeyword,
    return: ts.SyntaxKind.ReturnKeyword,
    set: ts.SyntaxKind.SetKeyword,
    static: ts.SyntaxKind.StaticKeyword,
    string: ts.SyntaxKind.StringKeyword,
    super: ts.SyntaxKind.SuperKeyword,
    switch: ts.SyntaxKind.SwitchKeyword,
    symbol: ts.SyntaxKind.SymbolKeyword,
    this: ts.SyntaxKind.ThisKeyword,
    throw: ts.SyntaxKind.ThrowKeyword,
    true: ts.SyntaxKind.TrueKeyword,
    try: ts.SyntaxKind.TryKeyword,
    type: ts.SyntaxKind.TypeKeyword,
    typeof: ts.SyntaxKind.TypeOfKeyword,
    undefined: ts.SyntaxKind.UndefinedKeyword,
    unique: ts.SyntaxKind.UniqueKeyword,
    unknown: ts.SyntaxKind.UnknownKeyword,
    var: ts.SyntaxKind.VarKeyword,
    void: ts.SyntaxKind.VoidKeyword,
    while: ts.SyntaxKind.WhileKeyword,
    with: ts.SyntaxKind.WithKeyword,
    yield: ts.SyntaxKind.YieldKeyword,
    async: ts.SyntaxKind.AsyncKeyword,
    await: ts.SyntaxKind.AwaitKeyword,
    of: ts.SyntaxKind.OfKeyword,
};

export function isStringANonContextualKeyword(name: string) {
    const token = stringToToken(name);
    return token !== undefined && isNonContextualKeyword(token);
}

export function isNonContextualKeyword(token: ts.SyntaxKind): boolean {
    return isKeyword(token) && !isContextualKeyword(token);
}
export function isKeyword(token: ts.SyntaxKind): boolean {
    return ts.SyntaxKind.FirstKeyword <= token && token <= ts.SyntaxKind.LastKeyword;
}
export function isContextualKeyword(token: ts.SyntaxKind): boolean {
    return (ts.SyntaxKind as any).FirstContextualKeyword <= token && token <= (ts.SyntaxKind as any).LastContextualKeyword;
}
export interface MapLike<T> {
    [index: string]: T;
}
export function getEntries<T>(obj: MapLike<T>): [string, T][] {
    return obj ? _entries(obj) : [];
}

const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Gets the owned, enumerable property keys of a map-like.
 */
export function getOwnKeys<T>(map: MapLike<T>): string[] {
    const keys: string[] = [];
    for (const key in map) {
        if (hasOwnProperty.call(map, key)) {
            keys.push(key);
        }
    }

    return keys;
}
const _entries = Object.entries || (<T>(obj: MapLike<T>) => {
    const keys = getOwnKeys(obj);
    const result: [string, T][] = Array(keys.length);
    for (let i = 0; i < keys.length; i++) {
        result[i] = [keys[i], obj[keys[i]]];
    }
    return result;
});

const textToToken = new Map(getEntries({
    ...textToKeywordObj,
    "{": ts.SyntaxKind.OpenBraceToken,
    "}": ts.SyntaxKind.CloseBraceToken,
    "(": ts.SyntaxKind.OpenParenToken,
    ")": ts.SyntaxKind.CloseParenToken,
    "[": ts.SyntaxKind.OpenBracketToken,
    "]": ts.SyntaxKind.CloseBracketToken,
    ".": ts.SyntaxKind.DotToken,
    "...": ts.SyntaxKind.DotDotDotToken,
    ";": ts.SyntaxKind.SemicolonToken,
    ",": ts.SyntaxKind.CommaToken,
    "<": ts.SyntaxKind.LessThanToken,
    ">": ts.SyntaxKind.GreaterThanToken,
    "<=": ts.SyntaxKind.LessThanEqualsToken,
    ">=": ts.SyntaxKind.GreaterThanEqualsToken,
    "==": ts.SyntaxKind.EqualsEqualsToken,
    "!=": ts.SyntaxKind.ExclamationEqualsToken,
    "===": ts.SyntaxKind.EqualsEqualsEqualsToken,
    "!==": ts.SyntaxKind.ExclamationEqualsEqualsToken,
    "=>": ts.SyntaxKind.EqualsGreaterThanToken,
    "+": ts.SyntaxKind.PlusToken,
    "-": ts.SyntaxKind.MinusToken,
    "**": ts.SyntaxKind.AsteriskAsteriskToken,
    "*": ts.SyntaxKind.AsteriskToken,
    "/": ts.SyntaxKind.SlashToken,
    "%": ts.SyntaxKind.PercentToken,
    "++": ts.SyntaxKind.PlusPlusToken,
    "--": ts.SyntaxKind.MinusMinusToken,
    "<<": ts.SyntaxKind.LessThanLessThanToken,
    "</": ts.SyntaxKind.LessThanSlashToken,
    ">>": ts.SyntaxKind.GreaterThanGreaterThanToken,
    ">>>": ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
    "&": ts.SyntaxKind.AmpersandToken,
    "|": ts.SyntaxKind.BarToken,
    "^": ts.SyntaxKind.CaretToken,
    "!": ts.SyntaxKind.ExclamationToken,
    "~": ts.SyntaxKind.TildeToken,
    "&&": ts.SyntaxKind.AmpersandAmpersandToken,
    "||": ts.SyntaxKind.BarBarToken,
    "?": ts.SyntaxKind.QuestionToken,
    "??": ts.SyntaxKind.QuestionQuestionToken,
    "?.": ts.SyntaxKind.QuestionDotToken,
    ":": ts.SyntaxKind.ColonToken,
    "=": ts.SyntaxKind.EqualsToken,
    "+=": ts.SyntaxKind.PlusEqualsToken,
    "-=": ts.SyntaxKind.MinusEqualsToken,
    "*=": ts.SyntaxKind.AsteriskEqualsToken,
    "**=": ts.SyntaxKind.AsteriskAsteriskEqualsToken,
    "/=": ts.SyntaxKind.SlashEqualsToken,
    "%=": ts.SyntaxKind.PercentEqualsToken,
    "<<=": ts.SyntaxKind.LessThanLessThanEqualsToken,
    ">>=": ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
    ">>>=": ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
    "&=": ts.SyntaxKind.AmpersandEqualsToken,
    "|=": ts.SyntaxKind.BarEqualsToken,
    "^=": ts.SyntaxKind.CaretEqualsToken,
    "||=": ts.SyntaxKind.BarBarEqualsToken,
    "&&=": ts.SyntaxKind.AmpersandAmpersandEqualsToken,
    "??=": ts.SyntaxKind.QuestionQuestionEqualsToken,
    "@": ts.SyntaxKind.AtToken,
    "`": ts.SyntaxKind.BacktickToken
}));

export function stringToToken(s: string): ts.SyntaxKind | undefined {

    return textToToken.get(s);
}

/**
 * Strip off existed surrounding single quotes, double quotes, or backticks from a given string
 *
 * @return non-quoted string
 */
export function stripQuotes(name: string) {
    const length = name.length;
    if (length >= 2 && name.charCodeAt(0) === name.charCodeAt(length - 1) && isQuoteOrBacktick(name.charCodeAt(0))) {
        return name.substring(1, length - 1);
    }
    return name;
}

export function isQuoteOrBacktick(charCode: number) {
    return charCode === CharacterCodes.singleQuote ||
        charCode === CharacterCodes.doubleQuote ||
        charCode === CharacterCodes.backtick;
}
const extensionsToRemove = [ts.Extension.Dts, ts.Extension.Ts, ts.Extension.Js, ts.Extension.Tsx, ts.Extension.Jsx, ts.Extension.Json];
export function removeFileExtension(path: string): string {
    for (const ext of extensionsToRemove) {
        const extensionless = tryRemoveExtension(path, ext);
        if (extensionless !== undefined) {
            return extensionless;
        }
    }
    return path;
}

export function tryRemoveExtension(path: string, extension: string): string | undefined {
    return path.endsWith(extension) ? removeExtension(path, extension) : undefined;
}

export function removeExtension(path: string, extension: string): string {
    return path.substring(0, path.length - extension.length);
}

export const enum CharacterCodes {
    nullCharacter = 0,
    maxAsciiCharacter = 0x7F,

    lineFeed = 0x0A,              // \n
    carriageReturn = 0x0D,        // \r
    lineSeparator = 0x2028,
    paragraphSeparator = 0x2029,
    nextLine = 0x0085,

    // Unicode 3.0 space characters
    space = 0x0020,   // " "
    nonBreakingSpace = 0x00A0,   //
    enQuad = 0x2000,
    emQuad = 0x2001,
    enSpace = 0x2002,
    emSpace = 0x2003,
    threePerEmSpace = 0x2004,
    fourPerEmSpace = 0x2005,
    sixPerEmSpace = 0x2006,
    figureSpace = 0x2007,
    punctuationSpace = 0x2008,
    thinSpace = 0x2009,
    hairSpace = 0x200A,
    zeroWidthSpace = 0x200B,
    narrowNoBreakSpace = 0x202F,
    ideographicSpace = 0x3000,
    mathematicalSpace = 0x205F,
    ogham = 0x1680,

    _ = 0x5F,
    $ = 0x24,

    _0 = 0x30,
    _1 = 0x31,
    _2 = 0x32,
    _3 = 0x33,
    _4 = 0x34,
    _5 = 0x35,
    _6 = 0x36,
    _7 = 0x37,
    _8 = 0x38,
    _9 = 0x39,

    a = 0x61,
    b = 0x62,
    c = 0x63,
    d = 0x64,
    e = 0x65,
    f = 0x66,
    g = 0x67,
    h = 0x68,
    i = 0x69,
    j = 0x6A,
    k = 0x6B,
    l = 0x6C,
    m = 0x6D,
    n = 0x6E,
    o = 0x6F,
    p = 0x70,
    q = 0x71,
    r = 0x72,
    s = 0x73,
    t = 0x74,
    u = 0x75,
    v = 0x76,
    w = 0x77,
    x = 0x78,
    y = 0x79,
    z = 0x7A,

    A = 0x41,
    B = 0x42,
    C = 0x43,
    D = 0x44,
    E = 0x45,
    F = 0x46,
    G = 0x47,
    H = 0x48,
    I = 0x49,
    J = 0x4A,
    K = 0x4B,
    L = 0x4C,
    M = 0x4D,
    N = 0x4E,
    O = 0x4F,
    P = 0x50,
    Q = 0x51,
    R = 0x52,
    S = 0x53,
    T = 0x54,
    U = 0x55,
    V = 0x56,
    W = 0x57,
    X = 0x58,
    Y = 0x59,
    Z = 0x5a,

    ampersand = 0x26,             // &
    asterisk = 0x2A,              // *
    at = 0x40,                    // @
    backslash = 0x5C,             // \
    backtick = 0x60,              // `
    bar = 0x7C,                   // |
    caret = 0x5E,                 // ^
    closeBrace = 0x7D,            // }
    closeBracket = 0x5D,          // ]
    closeParen = 0x29,            // )
    colon = 0x3A,                 // :
    comma = 0x2C,                 // ,
    dot = 0x2E,                   // .
    doubleQuote = 0x22,           // "
    equals = 0x3D,                // =
    exclamation = 0x21,           // !
    greaterThan = 0x3E,           // >
    hash = 0x23,                  // #
    lessThan = 0x3C,              // <
    minus = 0x2D,                 // -
    openBrace = 0x7B,             // {
    openBracket = 0x5B,           // [
    openParen = 0x28,             // (
    percent = 0x25,               // %
    plus = 0x2B,                  // +
    question = 0x3F,              // ?
    semicolon = 0x3B,             // ;
    singleQuote = 0x27,           // '
    slash = 0x2F,                 // /
    tilde = 0x7E,                 // ~

    backspace = 0x08,             // \b
    formFeed = 0x0C,              // \f
    byteOrderMark = 0xFEFF,
    tab = 0x09,                   // \t
    verticalTab = 0x0B,           // \v
}


export function isTypeOnlySymbol(s: ts.Symbol, checker: ts.TypeChecker): boolean {
    return !(skipAlias(s, checker).flags & ts.SymbolFlags.Value);
}

export function skipAlias(symbol: ts.Symbol, checker: ts.TypeChecker) {
    return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

/**
 * True if this type has a value at runtime (ie a class, Promise, or other reified type)
 * @param type
 * @returns
 */
export function typeHasValue(type: ts.Type) {
    return <boolean>type.isClass()
        || type.symbol?.name === 'Promise' // TODO: this is a bit hacky
        || !!type.symbol?.valueDeclaration
        ;
}

export function isNodeJS() {
    return Object.prototype.toString.call(typeof process !== 'undefined' ? process : 0) === '[object process]';
}

export function hasGlobalFlag(name: string) {
    return !!(globalThis as any)[name];
}

export function setGlobalFlag(name: string, value: any) {
    (globalThis as any)[name] = value;
}

export function resolveName(checker : ts.TypeChecker, location : ts.Node, name : string, meaning : ts.SymbolFlags, excludeGlobals : boolean): ts.Symbol {
    return (checker as any).resolveName(name, location, meaning, excludeGlobals);
}

export function isStatement(node: ts.Node): node is ts.Statement {
    return ts['isStatement'](node);
}

export function getTypeLocality(ctx: RttiContext, type: ts.Type, typeNode: ts.TypeNode): 'local' | 'imported' | 'global' {
    if (!type.symbol)
        return 'global';

    let typeSourceFile = type.symbol.declarations?.[0]?.getSourceFile();
    if (!typeSourceFile || ctx.program.isSourceFileDefaultLibrary(typeSourceFile))
        return 'global';

    let isLocal = typeSourceFile === ctx.sourceFile;

    // Ask Typescript if this is a global.
    // TODO: need another nearby node when there's no typeNode
    let resolvedGlobalSymbol = resolveName(ctx.checker, typeNode, type.symbol.name, ts.SymbolFlags.Value, false);
    let resolvedNonGlobalSymbol = resolveName(ctx.checker, typeNode, type.symbol.name, ts.SymbolFlags.Value, true);
    if (resolvedGlobalSymbol && !resolvedNonGlobalSymbol && resolvedGlobalSymbol === type.symbol)
        return 'global';

    return isLocal ? 'local' : 'imported';
}

export function hasFilesystemAccess() {
    if (isNodeJS()) {
        let fsx;
        try { fsx = require('fs'); } catch (e) {}
        return !!fsx;
    }

    return false;
}

export function fileExists(filename: string) {
    if (isNodeJS()) {
        let fsx;
        try { fsx = require('fs'); } catch (e) {}
        if (fsx)
            return fsx.existsSync(filename);
    }

    throw new Error(`No filesystem access available in this environment! Should guard using hasFilesystem()! This is a bug.`);
}