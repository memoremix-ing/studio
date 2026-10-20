/** Studio persistence for the canonical Solid example's API operations. */
export class TodoList {
  constructor(ctx) { this.storage = ctx.storage; }
  async fetch(request) {
    let todos = (await this.storage.get("todos")) || [];
    if (request.method === "POST") {
      const command = await request.json();
      switch (command.type) {
        case "add": {
          // Keep caller-generated identities stable across optimistic retries.
          const id = command.todo?.id ?? crypto.randomUUID();
          const title = String(command.todo?.title ?? command.title ?? "").trim().slice(0, 240);
          if (typeof id !== "string" || !id || id.length > 128 || /[\u0000-\u001f\u007f]/.test(id) || !title) {
            return new Response("Invalid todo", { status: 400 });
          }
          if (!todos.some(t => t.id === id)) {
            if (todos.length >= 100) return new Response("Todo limit reached", { status: 409 });
            todos.push({ id, title, completed: Boolean(command.todo?.completed) });
            todos.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
          }
          break;
        }
        case "toggle": {
          if (!todos.some(t => t.id === command.id)) return new Response("Todo not found", { status: 404 });
          todos = todos.map(t => t.id === command.id ? {
            ...t, completed: typeof command.completed === "boolean" ? command.completed : !t.completed
          } : t);
          break;
        }
        case "toggle_all": {
          const ids = Array.isArray(command.ids) ? new Set(command.ids) : null;
          todos = todos.map(t => !ids || ids.has(t.id) ? { ...t, completed: Boolean(command.completed) } : t);
          break;
        }
        case "remove": todos = todos.filter(t => t.id !== command.id); break;
        case "clear_completed": {
          const ids = Array.isArray(command.ids) ? new Set(command.ids) : null;
          todos = todos.filter(t => ids ? !ids.has(t.id) : !t.completed);
          break;
        }
        default: return new Response("Unknown command", { status: 400 });
      }
      await this.storage.put("todos", todos);
    } else if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }
    return Response.json(todos);
  }
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname !== "/api/todos") {
      return new Response("Use the performer preview, or GET /api/todos", { status: 404 });
    }
    return env.TODOS.getByName("default").fetch(request);
  }
};
