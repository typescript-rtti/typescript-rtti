export const MODULE_TYPES: ('commonjs' | 'esm')[] = [
    'commonjs',
    //'esm' // TODO: Jest use of "vm" module triggers a bug in Node.js making module loader hooks not work.
];