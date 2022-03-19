import ts from "typescript";

export interface InterfaceDetails {
    methodNames: ts.PropertyName[];
    propertyNames: ts.PropertyName[];
}
