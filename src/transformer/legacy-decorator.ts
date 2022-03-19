import ts from "typescript";

export function legacyDecorator(decorator: ts.Decorator) {
    decorator['__Φlegacy'] = true;
    return decorator;
}