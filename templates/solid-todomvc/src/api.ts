// Studio adapter for the canonical example's API interface. The upstream mock
// uses localStorage and random failures; this transport persists in Turso and
// reports real request failures to the unchanged optimistic/retry state layer.
export interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

type Command =
  | { type: "add"; todo: Todo }
  | { type: "remove"; id: string }
  | { type: "toggle"; id: string; completed: boolean }
  | { type: "toggle_all"; ids: string[]; completed: boolean }
  | { type: "clear_completed"; ids: string[] };

declare global {
  interface Window {
    studio: {
      request(input: { path: string; method: string; body: string | null }): Promise<{
        status: number;
        body: string;
      }>;
    };
  }
}

// Serialize reads and writes so a projection refresh observes preceding writes.
let pending = Promise.resolve();
function request(command?: Command): Promise<Todo[]> {
  const result = pending.then(async () => {
    const response = await window.studio.request({
      path: "/api/todos",
      method: command ? "POST" : "GET",
      body: command ? JSON.stringify(command) : null
    });
    if (response.status !== 200) throw new Error(response.body);
    return JSON.parse(response.body) as Todo[];
  });
  pending = result.then(() => {}, () => {});
  return result;
}

export const api = {
  getTodos: () => request(),
  async addTodo(todo: Todo) {
    const todos = await request({ type: "add", todo });
    return todos.find(t => t.id === todo.id)!;
  },
  async removeTodo(id: string) { await request({ type: "remove", id }); },
  async toggleTodo(id: string, completed: boolean) {
    const todos = await request({ type: "toggle", id, completed });
    return todos.find(t => t.id === id)!;
  },
  async toggleAll(ids: string[], completed: boolean) {
    await request({ type: "toggle_all", ids, completed });
  },
  async clearCompleted(ids: string[]) {
    await request({ type: "clear_completed", ids });
  }
};
