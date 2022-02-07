import { describe } from "razmin";
import { RunInvocation, runSimple } from "../runner.test";

describe('reify<T>()', it => {

    async function expectError(invocation : RunInvocation) {
        try {
            await runSimple(invocation);
        } catch (e) {
            return;
        }

        throw new Error(`Expected error`);
    }

    it('is an error to call it with an invalid type', async () => {
        async function badCall(code : string) {
            await expectError({
                modules: {
                    'typescript-rtti': { reify: a => a, reflect: a => a }
                },
                code: ` import { reify } from 'typescript-rtti'; ${code}`
            });
        }

        await badCall(`reify<Number | String>()`);
        await badCall(`reify<void>()`);
        await badCall(`reify<undefined>()`);
    });
});