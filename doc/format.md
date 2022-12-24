# `typescript-rtti` Emit Format

Information about the emitted metadata expressions, useful for understanding it as a user or developer.

## The `__RΦ` object

```typescript
/**
 * Each compilation unit which contains emitted RTTI contains a const declaration for the object `__RΦ`.
 * This object contains the file's type table as well as several helpers.
 */
const __RΦ = {
    /**
     * RΦ.m(key: string, value: any)
     *
     * Create a `Reflect.metadata()` decorator for the given key/value, if possible
     */
    m: (k, v) => (t, ...a) => t && Reflect.metadata ? Reflect.metadata(k, v)(t, ...a) : void 0,

    /**
     * RΦ.f(func: Function, decorators: Decorator[], name: string)
     *
     * Decorate a function expression with metadata. The return value will be the function.
     */
    f: (f, d, n) => (d.forEach(d => d(f)), Object.defineProperty(f, "name", { value: n, writable: false }), f),

    /**
     * RΦ.c(
     *  constructor: Function,
     *  classDecorators: Decorator[],
     *  instancePropertyDecorators: [string, Decorator[]],
     *  staticPropertyDecorators: [string, Decorator[]],
     *  name: string
     * )
     *
     * Decorate a class expression (not declaration) with metadata. The return value will be the class constructor.
     */
    c: (c, d, dp, dsp, n) => (
        d.forEach(d => d(c)),
        dp.forEach(([p, d]) => d(c.prototype, p)),
        dsp.forEach(([p, d]) => d(c, p)),
        n ? Object.defineProperty(c, "name", { value: n, writable: false }) : undefined,
        c
    ),

    /**
     * RΦ.r(dest: Object, src: Object)
     *
     * Terse alias for `Object.assign(dest, src)`. Used when upgrading type expression references at runtime.
     */
    r: (o, a) => (Object.assign(o, a)),

    /**
     * RΦ.a(id: number)
     *
     * Access an RtType stored within the type table. If the table entry is a deferred structural RtType (RΦ),
     * it will be resolved and the table entry will be updated. If the table entry is a deferred constructor /
     * interface token (LΦ), it will be resolved and the table entry will be replaced with the constructor / token.
     */
    a: id => {
        let t = __RΦ.t[id];
        if (t === void 0)
            return void 0;
        if (t.RΦ) {
            let r = t.RΦ;
            delete t.RΦ;
            __RΦ.r(t, r(t));
        }
        else if (t.LΦ) {
            let l = t.LΦ();
            delete t.LΦ;
            __RΦ.t[id] = t = l;
        }
        return t;
    },

    /**
     * RΦ.t
     *
     * The type table for this compilation unit. All types referenced within the emitted RTTI are stored here.
     * The index is the Typescript compiler's ID for the type. The value is an RtType (see `format.ts`).
     */
    t: {
        [79]: { /** RΦ: t => ({ TΦ: "F", r: __RΦ.a(81), p: [], f: "" }) **/ },
        [81]: { /** TΦ: "5", name: "A" **/ }
    }
};
```