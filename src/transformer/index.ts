/// <reference types="reflect-metadata" />
/**
 * RTTI Transformer
 *
 * This Typescript transformer does two things:
 * 1. When emitDecoratorMetadata is enabled, this emits Typescript's "design:*" metadata on all syntactic
 *    elements processed during a compilation, regardless of whether a decorator is originally present on the element.
 *    NOTE: You may not want this, because design:* has a number of flaws. If you disable emitDecoratorMetadata this
 *    transformer will still output the rt:* metadata items instead.
 * 2. Emits "rt:*" metadata on each syntactic element which describes compile-time semantics of an element,
 *    which encodes element type, public, private, protected, abstract, readonly, async, optional, lists of
 *    method names and property names for classes, and lists of parameter names, types, and modifiers for methods
 *    and classes (ie constructors).
 *
 * - The "rt:f" metadata item holds a string of flags, where each character indicates the positive presence of a flag.
 *   For the list of available flags, see src/common/flags.ts
 * - The "rt:i" metadata item contains an array of type references which point to interface objects representing the
 *   interfaces found in the "implements" clause of a class
 * - The "rt:t" metadata item represents the "type" of an item. This is the type of a property, the return type of a method,
 *   or Function in the case of a class (similar to "design:type" for a class).
 * - The "rt:p" metadata item represents parameters of a method or a class (ie constructor). It is an array of objects which
 *   each have n (name : string), t (type : Function), and optionally f (flags : string) options. The meaning of flags is
 *   as above.
 * - The "rt:P" metadata item represents an array of property names
 * - The "rt:m" metadata item represents an array of method names
 * - The "rt:SP" metadata item represents an array of static property names
 * - The "rt:Sm" metadata item represents an array of static method names
 * - The "rt:h" metadata item represents the "host" of the element. For methods, this is the class constructor
 *   or interface token of the enclosing class/interface.
 *
 */

import * as ts from 'typescript';

import { rtStore } from './rt-helper';
import { CompileError } from './common/compile-error';
import { RttiContext, RttiSettings } from './rtti-context';
import { ApiCallTransformer } from './api-call-transformer';
import { MetadataEmitter } from './metadata-emitter';
import { DeclarationsEmitter } from './declarations-emitter';
import { required } from './utils';

const transformer: (program: ts.Program) => ts.TransformerFactory<ts.SourceFile> = (program: ts.Program) => {
    if (globalThis.RTTI_TRACE)
        console.log(`RTTI: Entering program`);

    // Share a package.json cache across the whole program
    let pkgJsonMap = new Map<string, any>();

    const rttiTransformer: ts.TransformerFactory<ts.SourceFile> = (context: ts.TransformationContext) => {
        if (globalThis.RTTI_TRACE)
            console.log(`RTTI: Transformer setup`);

        return sourceFile => {

            if (globalThis.RTTI_TRACE)
                console.log(`RTTI: Transforming '${sourceFile.fileName}'`);

            let ctx: RttiContext = {
                program,
                checker: program.getTypeChecker(),
                currentNameScope: undefined,
                sourceFile,
                settings: {
                    ...required<RttiSettings>({
                        // Defaults
                        trace: false,
                        throwOnFailure: false,
                        omitLibTypeMetadata: true
                    }),
                    ...(context.getCompilerOptions().rtti as object)
                },
                transformationContext: context,
                typeMap: new Map<number, ts.Expression>(),
                pkgJsonMap,
                currentTopStatement: undefined,
                interfaceSymbols: []
            };

            if (sourceFile.isDeclarationFile || sourceFile.fileName.endsWith('.d.ts')) {
                if (ctx.settings.trace)
                    console.log(`#### Processing declaration ${sourceFile.fileName}`);
                return DeclarationsEmitter.emit(sourceFile, ctx);
            }

            if (ctx.settings.trace)
                console.log(`#### Processing ${sourceFile.fileName}`);

            globalThis.RTTI_TRACE = ctx.settings.trace;
            globalThis.RTTI_THROW_ON_FAILURE = ctx.settings.throwOnFailure;

            //////////////////////////////////////////////////////////
            // Transform reflect<T>() and reify<T>()

            sourceFile = <ts.SourceFile>ApiCallTransformer.transform(sourceFile, ctx);

            try {
                sourceFile = MetadataEmitter.emit(sourceFile, ctx);
            } catch (e) {
                if (e instanceof CompileError)
                    throw e;

                console.error(`RTTI: Failed to build source file ${sourceFile.fileName}: ${e.message} [please report]`);
                console.error(e);

                if (globalThis.RTTI_THROW_ON_FAILURE)
                    throw e;
            }

            sourceFile = ts.factory.updateSourceFile(
                sourceFile,
                [rtStore(ctx.typeMap), ...sourceFile.statements],
                sourceFile.isDeclarationFile,
                sourceFile.referencedFiles,
                sourceFile.typeReferenceDirectives,
                sourceFile.hasNoDefaultLib,
                sourceFile.libReferenceDirectives
            );

            if (globalThis.RTTI_TRACE)
                console.log(`RTTI: Finished transforming '${sourceFile.fileName}'`);
            return sourceFile;
        };
    };

    return rttiTransformer;
};

export default transformer;