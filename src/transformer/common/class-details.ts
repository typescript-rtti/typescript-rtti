import ts from "typescript";

export interface ClassDetails {
    methodNames : ts.PropertyName[];
    propertyNames : ts.PropertyName[];
    staticPropertyNames : ts.PropertyName[];
    staticMethodNames : ts.PropertyName[];
}
