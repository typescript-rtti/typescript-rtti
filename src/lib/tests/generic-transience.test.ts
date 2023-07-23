import { expect } from "chai";
import { describe, it } from "@jest/globals";
import { builtinClass, literal } from '../utils.test-harness';
import { reflect } from '../reflect';
import { CallSite } from '../callsite';
import { ReflectedCallSite } from '../types';

describe('Library: Generic transience', () => {
    it('reflects upon callsites', async () => {

        let callSite = ReflectedCallSite.from({
            TΦ: 'c',
            t: undefined,
            p: [literal(123), builtinClass(Boolean)],
            r: undefined,
            tp: [builtinClass(String), literal(321)],
        });

        expect(callSite.parameters.length).to.equal(2);
        expect(callSite.parameters[0].isLiteral(123)).to.be.true;
        expect(callSite.parameters[0].is('literal')).to.be.true;
        expect(callSite.parameters[0].as('literal').value).to.equal(123);
        expect(callSite.parameters[1].isBuiltinClass(Boolean)).to.be.true;
        expect(callSite.parameters[1].as('class').class).to.equal(Boolean);
        expect(callSite.parameters[1].is('literal')).to.be.false;

        expect(callSite.typeParameters.length).to.equal(2);
        expect(callSite.typeParameters[0].isBuiltinClass(String)).to.be.true;
        expect(callSite.typeParameters[0].is('literal')).to.be.false;
        expect(callSite.typeParameters[1].isLiteral(321)).to.be.true;
        expect(callSite.typeParameters[1].is('literal')).to.be.true;
        expect(callSite.typeParameters[1].as('literal').value).to.equal(321);

    });
});