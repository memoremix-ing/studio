export default {
  electrobun: { version: "2.0.4" },
  scripts: {
    dev: ["hutch", "electrobun", "dev"],
    build: ["hutch", "electrobun", "build", "--env=stable"],
  },
};
