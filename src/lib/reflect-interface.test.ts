import { expect } from "chai";
import { describe, it } from "@jest/globals";
import { ReflectedTypeRef } from ".";
import * as format from "../common/format";
import { runSimple } from "../runner.test-harness";
import { MODULE_TYPES } from "../transformer/tests/module-types.test-harness";
import { reify, reflect, ReflectedClass } from "./reflect";

describe('reflect<T>()', () => {
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
        });

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
    });
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
    });

    for (let moduleType of MODULE_TYPES) {
        it(`[${moduleType}] reflects properly for a default export interface`, async () => {
            let exports = await runSimple({
                moduleType,
                modules: {
                    "./IMovable.ts": `
                        export default interface IMovable {
                            position: Array<number>
                            readonly movementVelocity: Array<number>
                        }
                    `
                },
                code: `
                    import IMovable from './IMovable';

                    /**
                     * @rtti:callsite 1
                     */
                    function reflect<T>(_?, callsite?) {
                        return callsite;
                    }

                    export const callsite = reflect<IMovable>();
                `
            });

            let callsite = <format.RtCallSite>exports.callsite;
            expect(callsite.TΦ).to.equal(format.T_CALLSITE);
            let token = (callsite.tp[0] as format.InterfaceToken);
            expect(token.name).to.equal('IMovable');
        });
    }
});