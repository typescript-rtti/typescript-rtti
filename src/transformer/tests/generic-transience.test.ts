import { describe } from "razmin";
import { runSimple } from "../../runner.test";

describe('Generic transience', it => {
    it.skip('marks functions which reflect upon generic type parameters', () => {
        runSimple({
            trace: true,
            code: `
                import { reflect } from 'typescript-rtti';

                function a<T>() {
                    let type = reflect<T>();
                }
            `,
            modules: {
                'typescript-rtti': { 
                    reflect: () => {}
                }
            }
        })
    });
});