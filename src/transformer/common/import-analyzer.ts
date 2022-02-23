import { TypeImport } from "./type-import";
import { Visit, VisitorBase } from "./visitor-base";
import * as ts from 'typescript';

export class ImportAnalyzer extends VisitorBase {
    map = new Map<string,TypeImport>();

    static analyze(file : ts.SourceFile, context : ts.TransformationContext): Map<string,TypeImport> {
        let analyzer = new ImportAnalyzer(context);
        try {
            analyzer.visitEachChild(file);
        } catch (e) {
            console.error(`RTTI: While analyzing imports for file '${file.fileName}': ${e.message}`);
            throw e;
        }
        return analyzer.map;
    }

    @Visit(ts.SyntaxKind.ImportDeclaration)
    import(decl : ts.ImportDeclaration) {
        if (decl.importClause) {
            let bindings = decl.importClause.namedBindings;

            if (!bindings) {
                let name = decl.importClause.name.text;

                this.map.set(name, {
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
                        this.map.set(binding.name.text, {
                            name: binding.name.text,
                            localName: `${binding.propertyName?.text ?? binding.name.text}Φ`,
                            refName: binding.name.text,
                            modulePath: (<ts.StringLiteral>decl.moduleSpecifier).text,
                            isNamespace: false,
                            isDefault: false,
                            importDeclaration: decl
                        });

                        let nameAsInterface = `IΦ${binding.name.text}`;

                        this.map.set(nameAsInterface, {
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
                    this.map.set(bindings.name.text, {
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