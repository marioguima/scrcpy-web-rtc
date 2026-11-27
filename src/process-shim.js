// Browser compatibility for public @csl/ui full-shell dependencies that keep
// optional Next.js runtime guards in the distributed ESM bundle.
export const process = {
    env: {},
    nextTick(callback, ...args) { setTimeout(callback, 0, ...args); },
    emit() {},
};
