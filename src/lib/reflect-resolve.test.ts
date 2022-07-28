import {expect} from "chai";
import {describe} from "razmin";
import {
    ReflectedClassRef,
    ReflectedGenericRef,
    ReflectedInterfaceRef,
    ReflectedLiteralRef,
    ReflectedObjectRef,
    ReflectedTypeRef
} from ".";
import {runSimple} from "../runner.test";
import {reify, reflect} from "./reflect";

describe('reflect<T>() resolveType', it => {
    it('alias nested', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reify, reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type C = 1;
                export type B = C;
                export type A = B;
                export const a = reflect<A>();
            `,
        });
        let t = (exports.a as ReflectedTypeRef).resolveType();
        expect(t.kind)
            .to.equal("literal");
        expect(t.as('literal').value)
            .to.equal(1);
    });

    it('alias<1> nested', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reify, reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type C<T> = T;
                export type B<T> = C<T>;
                export type A<T> = B<T>;
                export const a = reflect<A<1>>();
            `,
        });
        let t = (exports.a as ReflectedTypeRef).resolveType();
        expect(t.kind)
            .to.equal("literal");
        expect(t.as('literal').value)
            .to.equal(1);
    });

    it('alias<{a:string}> nested', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reify, reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export type C<T> = T;
                export type B<T> = C<T>;
                export type A<T> = B<T>;
                export const a = reflect<A<{a:string}>>();
            `,
        });
        let t = (exports.a as ReflectedTypeRef).resolveType();
        expect(t.kind)
            .to.equal("object");
        expect(t.as(ReflectedObjectRef).members[0].type.as('class').class)
            .to.equal(String);
    });

    it('alias<I<T,K>> nested', async () => {
        let exports = await runSimple({
            modules: {
                "typescript-rtti": {reify, reflect},
            },
            code: `
                import { reflect } from 'typescript-rtti';
                export interface I<T,K>{
                    a:T;
                    b:K;
                }
                export type C<T> = I<T,string>;
                export type B<T> = C<T>;
                export type A<T> = B<T>;
                export const a = reflect<A<{a:string}>>();
            `
        });
        let t = (exports.a as ReflectedTypeRef).resolveType();
        expect(t.kind)
            .to.equal("interface");
        expect(t.as("interface").reflectedInterface.properties[0].type.as(ReflectedObjectRef).members[0].type.as('class').class)
            .to.equal(String);
        expect(t.as("interface").reflectedInterface.properties[1].type.as('class').class)
            .to.equal(String);
    });

});
