/**
 * @param {string} specifier
 * @param {{
 *   conditions: !Array<string>,
 *   parentURL: !(string | undefined),
 * }} context
 * @param {Function} defaultResolve
 * @returns {Promise<{ url: string }>}
 */
export async function resolve(url, context, defaultResolve) {
    if (!global['moduleOverrides'] || !global['moduleOverrides'][url])
        return defaultResolve(url, context, defaultResolve);

    let override = global['moduleOverrides'][url];
    let source = `
        const DATA = ${JSON.stringify(override)};
        export default DATA;
        ${Object.keys(override)
            .filter(k => isNaN(k))
            .map(k => `export const ${k} = DATA['${k}']`)
            .join(";\n")}
    `;

    // console.log(`Overriding module "${url}"...`);
    // console.log(`Using source:`);
    // console.log(source);

    return {
        url: `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
    };
}