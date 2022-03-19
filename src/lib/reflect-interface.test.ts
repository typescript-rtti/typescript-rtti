import { expect } from "chai";
import { describe } from "razmin";
import { ReflectedTypeRef } from ".";
import { runSimple } from "../runner.test";
import { reify, reflect, ReflectedClass } from "./reflect";

describe('reflect<T>()', it => {
    it('reifies and reflects', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": { reify, reflect },
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export interface Something {}
                export const reflectedTypeRef = reflect<Something>();
            `
        })

        expect((exports.reflectedTypeRef as ReflectedTypeRef).as('interface').token)
            .to.equal(exports.IΦSomething);
    });
    it(`doesn't rewrite other calls into typescript-rtti`, async () => {
        let exports = await runSimple({ 
            modules: {
                'typescript-rtti': {
                    other(passed?) {
                        return passed ?? 123;
                    }
                }
            },
            code: `
                import { reflect, other } from 'typescript-rtti';
                interface A {}
                export const value1 = other();
                export const value2 = other<A>();
            `
        });

        expect(exports.value1).to.equal(123);
        expect(exports.value2).to.equal(123);
    })
    it(`doesn't rewrite any calls for other libraries`, async () => {
        let exports = await runSimple({ 
            modules: {
                'other': {
                    reflect(passed?) {
                        return passed ?? 123;
                    },
                    reify(passed?) {
                        return passed ?? 123;
                    }
                }
            },
            code: `
                import { reflect, reify } from 'other';
                interface A {}
                export const value1 = reflect();
                export const value2 = reflect<A>();
                export const value3 = reify();
                export const value4 = reify<A>();
            `
        });

        expect(exports.value1).to.equal(123);
        expect(exports.value2).to.equal(123);
        expect(exports.value3).to.equal(123);
        expect(exports.value4).to.equal(123);
    })    
    it('reflects properly for a default export interface', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": { reify, reflect },
                "./IMovable.ts": `
                    export default interface IMovable {
                        position: Array<number>
                        readonly movementVelocity: Array<number>
                    }
                `
            },
            code: `
                import { reflect } from 'typescript-rtti';
                import IMovable from './command/move/IMovable';

                export const reflectedInterface = reflect<IMovable>().as('interface').reflectedInterface;
            `
        })

        expect((exports.reflectedInterface) instanceof ReflectedClass).to.be.true;
    });
});