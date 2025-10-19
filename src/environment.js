/**
 * Environment detection utility
 * Detects if running in browser or Node.js environment
 */

const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

module.exports = {
    isBrowser,
    isNode,
    getEnvironment: () => isBrowser ? 'browser' : isNode ? 'node' : 'unknown'
};