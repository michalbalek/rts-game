/**
 * Compose cohesive capabilities onto an engine's existing public prototype.
 * Methods execute on that engine instance, sharing its state and peer methods.
 * Copying descriptors preserves non-enumerable, writable class-method semantics
 * without changing the engine's constructor, prototype chain or caller API.
 */
export function installEngineMethods(engine, ...capabilities) {
  for (const capability of capabilities) {
    const descriptors = Object.getOwnPropertyDescriptors(capability.prototype);
    delete descriptors.constructor;
    for (const name of Object.keys(descriptors)) {
      if (Object.hasOwn(engine.prototype, name)) {
        throw new Error(`Duplicate engine method: ${name}`);
      }
    }
    Object.defineProperties(engine.prototype, descriptors);
  }
}
