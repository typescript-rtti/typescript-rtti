import ts from 'typescript';

export function getRootNameOfQualifiedName(qualifiedName : ts.QualifiedName) {
    if (ts.isQualifiedName(qualifiedName.left))
        return getRootNameOfQualifiedName(qualifiedName.left);
    else if (ts.isIdentifier(qualifiedName.left))
        return qualifiedName.left.text;
}

export function getRootNameOfEntityName(entityName : ts.EntityName) {
    if (ts.isQualifiedName(entityName)) {
        return getRootNameOfQualifiedName(entityName);
    } else if (ts.isIdentifier(entityName)) {
        return entityName.text;
    }
}

export function cloneQualifiedName(qualifiedName : ts.QualifiedName, rootName? : string) {
    let left : ts.Expression;
    if (ts.isIdentifier(qualifiedName.left)) {
        left = ts.factory.createIdentifier(rootName);
    } else {
        left = cloneEntityNameAsExpr(qualifiedName.left, rootName)   
    }
    return ts.factory.createPropertyAccessExpression(left, cloneEntityNameAsExpr(qualifiedName.right));
}

export function cloneEntityNameAsExpr(entityName : ts.EntityName, rootName? : string) {
    if (ts.isQualifiedName(entityName))
        return cloneQualifiedName(entityName, rootName);
    else if (ts.isIdentifier(entityName))
        return ts.factory.createIdentifier(entityName.text);
}

export function qualifiedNameToString(qualifiedName : ts.QualifiedName) {
    return ts.isIdentifier(qualifiedName.left) 
        ? qualifiedName.left.text + '.' + qualifiedName.right.text
        : entityNameToString(qualifiedName.left) + '.' + qualifiedName.right.text
    ;
}

export function entityNameToString(entityName : ts.EntityName) {
    if (ts.isQualifiedName(entityName))
        return qualifiedNameToString(entityName);
    else if (ts.isIdentifier(entityName))
        return entityName.text;
}

export function dottedNameToExpr(dottedName : string) : ts.Identifier | ts.PropertyAccessExpression {
    return dottedName
        .split('.')
        .map(ident => ts.factory.createIdentifier(ident) as (ts.Identifier | ts.PropertyAccessExpression))
        .reduce((pv, cv : ts.Identifier) => 
            pv 
                ? ts.factory.createPropertyAccessExpression(pv, cv) 
                : cv
        )
    ;
}
