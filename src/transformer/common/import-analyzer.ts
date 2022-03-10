import { Visit } from "./visitor-base";
import * as ts from 'typescript';
import { RttiVisitor } from "../rtti-visitor-base";
import { RttiContext } from "../rtti-context";

export class ImportAnalyzer extends RttiVisitor {
    static analyze(file : ts.SourceFile, ctx : RttiContext) {
        let analyzer = new ImportAnalyzer(ctx);
        try {
            analyzer.visitEachChild(file);
        } catch (e) {
            console.error(`RTTI: While analyzing imports for file '${file.fileName}': ${e.message}`);
            throw e;
        }
    }

    @Visit(ts.SyntaxKind.ImportDeclaration)
    import(decl : ts.ImportDeclaration) {
        if (decl.importClause) {
            let bindings = decl.importClause.namedBindings;

            if (!bindings) {
                let name = decl.importClause.name.text;

                this.ctx.importMap.set(name, {
                    name,
                    localName: name,
                    refName: name,
                    modulePath: (<ts.StringLiteral>decl.moduleSpecifier).text,
                    isNamespace: false,
                    isDefault: true,
                    importDeclaration: decl
                })
            } else if (bindings) {
                if (ts.isNamedImports(bindings)) {
                    for (let binding of bindings.elements) {
                        this.ctx.importMap.set(binding.name.text, {
                            name: binding.name.text,
                            symbol: this.checker.getSymbolAtLocation(binding.name),
                            localName: `${binding.propertyName?.text ?? binding.name.text}Φ`,
                            refName: binding.name.text,
                            modulePath: (<ts.StringLiteral>decl.moduleSpecifier).text,
                            isNamespace: false,
                            isDefault: false,
                            importDeclaration: decl
                        });

                        let nameAsInterface = `IΦ${binding.name.text}`;

                        this.ctx.importMap.set(nameAsInterface, {
                            name: nameAsInterface,
                            localName: nameAsInterface,
                            refName: nameAsInterface,
                            modulePath: (<ts.StringLiteral>decl.moduleSpecifier).text,
                            isNamespace: false,
                            isDefault: false,
                            importDeclaration: decl
                        });
                    }
                } else if (ts.isNamespaceImport(bindings)) {
                    this.ctx.importMap.set(bindings.name.text, {
                        name: bindings.name.text,
                        localName: `${bindings.name.text}Φ`,
                        modulePath: (<ts.StringLiteral>decl.moduleSpecifier).text,
                        refName: bindings.name.text,
                        isNamespace: true,
                        isDefault: false,
                        importDeclaration: decl
                    })
                    bindings.name
                }
            }
        }
    }
}