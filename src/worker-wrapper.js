import * as app from "./__STUDIO_ORIGINAL__";
import { WorkerEntrypoint } from "cloudflare:workers";

// Only this app's state enters its worker. All database authority stays in Rust.
export class StudioEntrypoint extends WorkerEntrypoint {
  async run(input) {
    const state = JSON.parse(this.env.STUDIO_STATE);
    const env = Object.create(null);
    const instances = new Map();
    for (const [binding, className] of Object.entries(JSON.parse(this.env.STUDIO_NAMESPACES))) {
      const namespace = Object.hasOwn(state,binding) ? state[binding] : (Object.defineProperty(state,binding,{value:{},enumerable:true,writable:true}),state[binding]);
      env[binding] = {
        idFromName(name) { return String(name); },
        getByName(name) { return this.get(this.idFromName(name)); },
        get(name) {
          if (typeof name !== "string" || !name || name.length > 128) throw new Error("Invalid object name");
          const identity = JSON.stringify([binding, name]);
          return { async fetch(request, init) {
            let instance = instances.get(identity);
            if (!instance) {
              const values = Object.hasOwn(namespace, name) ? namespace[name] : (Object.defineProperty(namespace, name, {value:{}, enumerable:true, writable:true}), namespace[name]);
              const storage = {
                async get(key) { return Object.hasOwn(values,key) ? structuredClone(values[key]) : undefined; },
                async put(key, value) {
                  if (typeof key !== "string" || !key || key.length > 256) throw new Error("Invalid key");
                  Object.defineProperty(values, key, {value:JSON.parse(JSON.stringify(value)), enumerable:true, configurable:true, writable:true});
                },
                async delete(key) { const had = Object.hasOwn(values, key); delete values[key]; return had; },
                async deleteAll() { for (const key of Object.keys(values)) delete values[key]; },
                async list() { return new Map(Object.entries(structuredClone(values)).sort(([a],[b]) => a.localeCompare(b))); }
              };
              const Constructor = app[className];
              if (typeof Constructor !== "function") throw new Error(`Missing object class: ${className}`);
              instance = new Constructor({id: {name, toString: () => name}, storage}, env);
              instances.set(identity, instance);
            }
            return instance.fetch(request instanceof Request ? request : new Request(request, init));
          }};
        }
      };
    }
    const request = new Request(`https://booth.invalid${input.path}`, {
      method: input.method,
      ...(input.body === null ? {} : {body: input.body}),
      headers: {"Content-Type":"application/json"}
    });
    const response = await app.default.fetch(request, env, {waitUntil() { throw new Error("Background work is not supported"); }});
    const reader = response.body?.getReader();
    const chunks = []; let size = 0;
    if (reader) for (;;) {
      const {value,done} = await reader.read(); if (done) break;
      size += value.length; if (size > 65536) throw new Error("Response exceeds 64 KiB");
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
    return {response:{status:response.status, body:new TextDecoder().decode(bytes)}, state};
  }
}
