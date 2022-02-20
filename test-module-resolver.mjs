/**
 * @param {string} url
 * @param {{
 *   conditions: !Array<string>,
 *   parentURL: !(string | undefined),
 * }} context
 * @param {Function} defaultResolve
 * @returns {Promise<{ url: string }>}
 */
export async function resolve(url, context, defaultResolve) {
    //console.log(`RTTI Test: ESM: Resolving '${url}'`);

    let filename = url;
    if (!filename.startsWith('data:')) {
        if (!filename.endsWith('.js'))
            filename = `${filename}.js`;
        if (!filename.includes('/'))
            filename = `./${filename}`;
    }

    let moduleOverrides = global['moduleOverrides'] || {};

    if (!moduleOverrides[url] && !moduleOverrides[filename]) {
        //console.log(`RTTI Test: ESM: Using default resolver.`);
        return defaultResolve(url, context, defaultResolve);
    }

    //console.log(`RTTI Test: ESM: Using custom resolver.`);

    let override = moduleOverrides[filename] || moduleOverrides[url];
    let source;

    if (typeof override === 'object') {
        source = `
            const DATA = ${JSON.stringify(override)};
            export default DATA;
            ${Object.keys(override)
                .filter(k => isNaN(k) && typeof override[k] !== 'function')
                .map(k => `export const ${k} = DATA['${k}']`)
                .join(";\n")}
            ${Object.keys(override)
                .filter(k => isNaN(k) && typeof override[k] === 'function')
                .map(k => `export const ${k} = (${override[k].toString()})`)
                .join(";\n")}
        `;
    } else {
        source = `
            ${override}
        `
    }

    // console.log(`Overriding module "${url}"...`);
    // console.log(`Using source:`);
    // console.log(source);

    return {
        url: `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
    };
}