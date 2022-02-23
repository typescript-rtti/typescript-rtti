import * as ts from 'typescript';

export interface TypeImport {
    importDeclaration : ts.ImportDeclaration;
    refName : string;
    modulePath : string;
    isNamespace : boolean;
    isDefault : boolean;
    referenced? : boolean;
    name : string;
    localName : string;
}