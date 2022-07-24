
// Until https://github.com/microsoft/TypeScript/issues/49794 is resolved we cannot
// correctly add our decorators to the decorators array without triggering a bug for classes
// which have initialized static fields.
export const WORKAROUND_TYPESCRIPT_49794 = true;