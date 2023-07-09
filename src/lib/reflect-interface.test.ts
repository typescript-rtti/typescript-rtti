import { expect } from "chai";
import { describe, it } from "@jest/globals";
import { ReflectedTypeRef } from ".";
import * as format from "../common/format";
import { runSimple } from "../runner.test-harness";
import { MODULE_TYPES } from "../transformer/tests/module-types.test-harness";
import { reify, reflect, ReflectedClass } from "./reflect";

describe('reflect<T>()', () => {
    it('reifies and reflects', async () => {
        const IΦSomething = {
            name: 'Something',
            prototype: {},
            identity: Symbol('Something (interface)')
        };

        const iface = reflect(<never>undefined, <format.RtCallSite>{ 'TΦ': 'c', tp: [ IΦSomething ]});
        expect(iface.as('interface').token).to.equal(IΦSomething);
    });
    it(`doesn't rewrite other calls into typescript-rtti`, async () => {
        await runSimple({
            modules: {
                'typescript-rtti': {
                    other: (passed?) => passed ?? 123
                }
            },
            code: `
                import { reflect, other } from 'typescript-rtti';
                interface A {}
                export const value1 = other();
                export const value2 = other<A>();
            `,
            checks: exports => {
                expect(exports.value1).to.equal(123);
                expect(exports.value2).to.equal(123);
            }
        });
    });
    it(`doesn't rewrite any calls for other libraries`, async () => {
        await runSimple({
            modules: {
                'other': {
                    reflect: (passed?) => passed ?? 123,
                    reify: (passed?) => passed ?? 123
                }
            },
            code: `
                import { reflect, reify } from 'other';
                interface A {}
                export const value1 = reflect();
                export const value2 = reflect<A>();
                export const value3 = reify();
                export const value4 = reify<A>();
            `,
            checks: exports => {
                expect(exports.value1).to.equal(123);
                expect(exports.value2).to.equal(123);
                expect(exports.value3).to.equal(123);
                expect(exports.value4).to.equal(123);
            }
        });
    });

    it(`reflects properly for a default export interface`, async () => {
        await runSimple({
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
            `,
            checks: exports => {
                let callsite = <format.RtCallSite>exports.callsite;
                expect(callsite.TΦ).to.equal('c');
                let token = (callsite.tp[0] as format.InterfaceToken);
                expect(token.name).to.equal('IMovable');
            }
        });
    });
});