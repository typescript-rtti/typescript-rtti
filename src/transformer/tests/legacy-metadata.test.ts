
import { expect } from 'chai';
import { describe, it } from '@jest/globals';
import ts from 'typescript';
import { runSimple } from '../../runner.test-harness';
import { F_INFERRED, F_METHOD, F_PUBLIC } from '../../common/format';

const hasOwnProperty = Object.prototype.hasOwnProperty;
function hasProperty(map: ts.MapLike<any>, key: string): boolean {
    return hasOwnProperty.call(map, key);
}

const MODULE_TYPES: ('commonjs' | 'esm')[] = ['commonjs', 'esm'];

describe('emitDecoratorMetadata=true: ', () => {
    describe('design:type', () => {

        it('emits for method', async () => {
            let exports = await runSimple({
                code: `
                    function noop() { return (t, ...a) => {} };

                    export class A { }
                    export class B { }
                    export class C {
                        @noop() method(parm : A, parm2 : B) { }
                    }
                `,
                compilerOptions: {
                    emitDecoratorMetadata: true
                }
            });

            let type = Reflect.getMetadata('design:type', exports.C.prototype, 'method');
            expect(type).to.equal(Function);
        });
        it('emits Object for untyped property', async () => {
            let exports = await runSimple({
                code: `
                    export function foo() { return t => {}; }
                    export class A { }
                    export class C {
                        @foo() prop;
                    }
                `,
                compilerOptions: {
                    emitDecoratorMetadata: true
                }
            });

            let type = Reflect.getMetadata('design:type', exports.C.prototype, 'prop');
            expect(type).to.equal(Object);
        });
        it('emits for property', async () => {
            let exports = await runSimple({
                code: `
                    function noop() { return (t, ...a) => {} };
                    export class A { }
                    export class B { }
                    export class C {
                        @noop() property : B;
                    }
                `,
                compilerOptions: {
                    emitDecoratorMetadata: true
                }
            });

            let type = Reflect.getMetadata('design:type', exports.C.prototype, 'property');
            expect(type).to.equal(exports.B);
        });
        it('emits for property with type from a default export', async () => {
            let exports = await runSimple({
                code: `
                    import B from './other';

                    function noop() { return (t, ...a) => {} };
                    export class C {
                        @noop() property : B;
                    }

                    export const _B = B;
                `,
                modules: {
                    './other.ts': `
                        export default class B { }
                    `
                },
                compilerOptions: {
                    emitDecoratorMetadata: true
                }
            });

            let type = Reflect.getMetadata('design:type', exports.C.prototype, 'property');
            expect(type).to.equal(exports._B);
        });
        it('emits for property in a class within a function', async () => {
            let exports = await runSimple({
                code: `
                    function noop() { return (t, ...a) => {} };
                    export class A { }
                    export class B { }
                    export function a() {
                        class C {
                            @noop() property : B;
                        }

                        return C;
                    }
                `,
                compilerOptions: {
                    emitDecoratorMetadata: true
                }
            });

            let C = exports.a();
            let type = Reflect.getMetadata('design:type', C.prototype, 'property');
            expect(type).to.equal(exports.B);
        });
        it('emits for property getter in a class', async () => {
            let exports = await runSimple({
                code: `
                    function noop() { return (t, ...a) => {} };
                    export class A { }
                    export class B { }
                    export class C {
                        @noop() get property : B { return null; }
                    }
                `,
                compilerOptions: {
                    emitDecoratorMetadata: true
                }
            });

            let C = exports.C;
            let type = Reflect.getMetadata('design:type', C.prototype, 'property');
            expect(type).to.equal(exports.B);
        });
        it('emits for property of type Promise', async () => {
            let exports = await runSimple({
                code: `
                    function noop() { return (t, ...a) => {} };

                    export class A { }
                    export class B { }
                    export class C {
                        @noop() property : Promise<B>;
                    }
                `,
                compilerOptions: {
                    emitDecoratorMetadata: true
                }
            });

            let type = Reflect.getMetadata('design:type', exports.C.prototype, 'property');
            expect(type).to.equal(Promise);
        });
        it('emits properly with circular dependencies', async () => {
            let exports = await runSimple({
                code: `
                    export { Post } from './post';
                    export { PostDetails } from './post-details';
                `,
                modules: {
                    './post.ts': `
                        import { PostDetails } from './post-details';

                        function noop() { return (t, ...a) => {} };

                        export class Post {
                            makeDetails() {
                                this.details = new PostDetails();
                            }
                            @noop() details: PostDetails;
                        }
                    `,
                    './post-details.ts': `
                        import { Post } from './post';

                        function noop() { return (t, ...a) => {} };

                        export class PostDetails {
                            makePost() {
                                this.post = new Post();
                            }
                            @noop() post : Post;
                        }
                    `
                },
                compilerOptions: {
                    emitDecoratorMetadata: true
                }
            });

            expect(Reflect.getMetadata('design:type', exports.Post.prototype, 'details'))
                .to.equal(exports.PostDetails);
            expect(Reflect.getMetadata('design:type', exports.PostDetails.prototype, 'post'))
                .to.equal(undefined); // because of the circular reference
        });
    });
    describe('design:paramtypes', () => {
        it('emits for ctor params', async () => {
            let exports = await runSimple({
                code: `
                    function noop() { return (t, ...a) => {} };

                    export class A { }
                    export class B { }
                    @noop() export class C {
                        constructor(hello : A, world : B) { }
                    }
                `,
                compilerOptions: {
                    emitDecoratorMetadata: true
                }
            });

            let params = Reflect.getMetadata('design:paramtypes', exports.C);
            expect(params).to.eql([exports.A, exports.B]);
        });
        it('emits for method params', async () => {
            let exports = await runSimple({
                code: `
                    function noop() { return (t, ...a) => {} };

                    export class A { }
                    export class B { }
                    export class C {
                        @noop() method(parm : A, parm2 : B) { }
                    }
                `,
                compilerOptions: {
                    emitDecoratorMetadata: true
                }
            });

            let params = Reflect.getMetadata('design:paramtypes', exports.C.prototype, 'method');
            expect(params).to.eql([exports.A, exports.B]);
        });
        it('emits expected intrinsic types', async () => {
            let exports = await runSimple({
                code: `
                    function noop() { return (t, ...a) => {} };

                    export class A { }
                    export class B { }
                    export class C {
                        @noop() method(a : string, b : number, c : boolean, d : Function, e : RegExp) { }
                    }
                `,
                compilerOptions: {
                    emitDecoratorMetadata: true
                }
            });

            let params = Reflect.getMetadata('design:paramtypes', exports.C.prototype, 'method');

            expect(params[0]).to.equal(String);
            expect(params[1]).to.equal(Number);
            expect(params[2]).to.equal(Boolean);
            expect(params[3]).to.equal(Function);
            expect(params[4]).to.equal(RegExp);

        });
        it('emits imported class', async () => {

            let exports = await runSimple({
                code: `
                    /// <reference path="./test-defn.d.ts" />
                    import * as test from 'test';
                    function noop() { return (t, ...a) => {} };
                    export class C {
                        @noop() method(foo: test.Foo) { }
                    }
                `,
                modules: {
                    'test': {
                        Foo: class {
                            static blah = 123;
                        }
                    },
                    './test-defn.d.ts': `
                        declare module "test" {
                            export class Foo {
                                static blah: number;
                            }
                        }
                    `
                },
                compilerOptions: {
                    emitDecoratorMetadata: true
                }
            });

            let params = Reflect.getMetadata('design:paramtypes', exports.C.prototype, 'method');

            expect(params[0].blah).to.equal(123);
        });
    });
    describe('design:returntype', () => {
        it('emits for string-like enum return type', async () => {
            let exports = await runSimple({
                code: `
                    function noop() { return (t, ...a) => {} };

                    export enum Foo {
                        one = 'one',
                        two = 'two'
                    }
                    export class C {
                        @noop() method(): Foo { return Foo.one; }
                    }
                `,
                compilerOptions: {
                    emitDecoratorMetadata: true
                }
            });

            let type = Reflect.getMetadata('design:returntype', exports.C.prototype, 'method');
            expect(type).to.equal(String);
        });
        it('emits for number-like enum return type', async () => {
            let exports = await runSimple({
                code: `
                    function noop() { return (t, ...a) => {} };

                    export enum Foo {
                        one = 1,
                        two = 2
                    }
                    export class C {
                        @noop() method(): Foo { return Foo.one; }
                    }
                `,
                compilerOptions: {
                    emitDecoratorMetadata: true
                }
            });

            let type = Reflect.getMetadata('design:returntype', exports.C.prototype, 'method');
            expect(type).to.equal(Number);
        });
        it('emits for object-like enum return type', async () => {
            let exports = await runSimple({
                code: `
                    function noop() { return (t, ...a) => {} };

                    export enum Foo {
                        one = 'one',
                        two = 2
                    }
                    export class C {
                        @noop() method(): Foo { return Foo.one; }
                    }
                `,
                compilerOptions: {
                    emitDecoratorMetadata: true
                }
            });

            let type = Reflect.getMetadata('design:returntype', exports.C.prototype, 'method');
            expect(type).to.equal(Object);
        });
        it('emits the designed type on a method', async () => {
            let exports = await runSimple({
                code: `
                    function noop() { return (t, ...a) => {} };

                    export class A { }
                    export class B { }
                    export class C {
                        @noop() method(parm : A, parm2 : B): B { return null; }
                    }
                `,
                compilerOptions: {
                    emitDecoratorMetadata: true
                }
            });

            let params = Reflect.getMetadata('design:returntype', exports.C.prototype, 'method');
            expect(params).to.equal(exports.B);
        });
        it('emits for bare inferred Promise return type', async () => {
            let exports = await runSimple({
                code: `
                    function noop() { return (t, ...a) => {} };

                    export class A { }
                    export class B { }
                    export class C {
                        @noop() async method(hello : A, world : B) {
                            return 123;
                        }
                    }
                `,
                compilerOptions: {
                    emitDecoratorMetadata: true
                }
            });

            let type = Reflect.getMetadata('design:returntype', exports.C.prototype, 'method');

            expect(type).to.equal(Promise);
        });
        it('emits void 0 on a method returning nothing', async () => {
            let exports = await runSimple({
                code: `
                    function noop() { return (t, ...a) => {} };

                    export class A { }
                    export class B { }
                    export class C {
                        @noop() method(parm : A, parm2 : B) { }
                    }
                `,
                compilerOptions: {
                    emitDecoratorMetadata: true
                }
            });

            let params = Reflect.getMetadata('design:returntype', exports.C.prototype, 'method');
            expect(params).to.equal(void 0);
        });
        it('emits void 0 on a method returning an inferred intrinsic', async () => {
            let exports = await runSimple({
                code: `
                    export class A { }
                    export class B { }
                    export class C {
                        method(parm : A, parm2 : B) { return 123; }
                    }
                `,
                compilerOptions: {
                    emitDecoratorMetadata: true
                }
            });

            let params = Reflect.getMetadata('design:returntype', exports.C.prototype, 'method');
            expect(params).to.equal(void 0);
        });
        it('emits void 0 on a method returning an inferred class type', async () => {
            let exports = await runSimple({
                code: `
                    export class A { }
                    export class B { }
                    export class C {
                        method(parm : A, parm2 : B) { return new B(); }
                    }
                `,
                compilerOptions: {
                    emitDecoratorMetadata: true
                }
            });

            let params = Reflect.getMetadata('design:returntype', exports.C.prototype, 'method');
            expect(params).to.equal(void 0);
        });
    });
});
describe('emitDecoratorMetadata=false: ', () => {
    it('does not emit design:paramtypes for ctor params', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B {
                    constructor(hello : A) { }
                }
            `,
            compilerOptions: {
                emitDecoratorMetadata: false
            }
        });

        let params = Reflect.getMetadata('design:paramtypes', exports.B);
        expect(params).not.to.exist;
    });
    it('does not emit design:paramtypes for method params', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) { }
                }
            `,
            compilerOptions: {
                emitDecoratorMetadata: false
            }
        });

        let params = Reflect.getMetadata('design:paramtypes', exports.C.prototype, 'method');
        expect(params).not.to.exist;
    });
    it('does not emit design:type for method', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    method(hello : A, world : B) { }
                }
            `,
            compilerOptions: {
                emitDecoratorMetadata: false
            }
        });

        let type = Reflect.getMetadata('design:type', exports.C.prototype, 'method');
        expect(type).not.to.exist;
    });
    it('does emit rt:f on a method', async () => {
        let exports = await runSimple({
            code: `
                export class A { }
                export class B { }
                export class C {
                    public method(hello : A, world : B) { }
                }
            `,
            compilerOptions: {
                emitDecoratorMetadata: false
            }
        });

        let type = Reflect.getMetadata('rt:f', exports.C.prototype, 'method');
        expect(Array.from(type)).to.include.all.members([F_METHOD, F_PUBLIC, F_INFERRED]);
    });
});


async function foo() {
    if (1)
        return null;
    return 'foo';
}