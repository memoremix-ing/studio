export default {
  async fetch(request) {
    const name = new URL(request.url).searchParams.get("name") || "remixer";
    return Response.json({ message: `Hello, ${name}!`, remix: "Make this app your own." });
  },
};
