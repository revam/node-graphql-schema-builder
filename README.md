# graphql-schema-builder

A simple GraphQL schema builder

## Install

Install from github:

**Spesific release:**

```sh
$ npm install --save https://github.com/revam/node-graphql-schema-builder/releases/download/v$VERSION/package.tgz
```

Install from git.lan (Internet people can ignore this):

**Latest release:**

```sh
$ npm install --save https://git.lan/mist@node/graphql-schema-builder@latest/npm-pack.tgz
```

**Spesific release:**

```sh
$ npm install --save https://git.lan/mist@node/graphql-schema-builder@v$VERSION/npm-pack.tgz
```

## Usage

Simple import function.

```js
import SchemaBuilder from "schema-builder";

async function buildSchema(schemaFolder) {
  // You can provide the constructor with an alternate load order for known ids.
  const builder = new SchemaBuilder(["index", "Query", "Mutation", "Subscription"]);
  await builder.importFrom(schemaFolder);
  return builder.buildSchema();
}
```

Apollo server example.

Note: [script-loader](https://github.com/revam/node-script-loader) is another
private package.

```js
import { ApolloServer } from "apollo-server";
import SchemaBuilder from "graphql-schema-builder";
import ScriptLoader from "script-loader";

// See script-loader (>=0.2.1) for more info.
ScriptLoader.start({
  configPath: "./config.json",
  info: {
    description: "Apollo server example using schema builder",
    name: "graphql-apollo-server-example",
    version: "1.0.0",
  },
  prefixEnv: "NODE_",
  script: {
    description: "Start the server",
    name: "start-server",
  },
  startupSteps: [
    importSchema,
    startServer,
  ],
});

// Import the schema
async function importSchema(loader) {
  console.log("Importing schema...");
  const builder = loader.state.builder = new SchemaBuilder();
  await builder.importFrom(loader.getSettingOrEnv("schema-path", "./schema"));
}

// Start the server
async function startServer(loader) {
  console.log("Starting server...");
  const builder = loader.state.builder;
  const server = new ApolloServer({
    ...builder.prepareSchema(),
    context: createContext,
  });
  const { url } = await server.listen();
  console.log("Server started, listening on %s", url);
  return async () => server.stop();

  async function createContext(context) {
    return {
      ...context,
      loader,
    };
  }
}
```

Express server example.

Note: [script-loader](https://github.com/revam/node-script-loader) is another
private package.

```js
import express from "express";
import graphql from "express-graphql";
import SchemaBuilder from "graphql-schema-builder";
import { createServer } from "http";
import ScriptLoader from "script-loader";
import { promisify } from "util";

// See script-loader (>=0.2.1) for more info.
ScriptLoader.start({
  configPath: "./config.json",
  info: {
    description: "GraphQL express server example using schema builder",
    name: "graphql-expesss-server-example",
    version: "1.0.0",
  },
  prefixEnv: "NODE_",
  script: {
    description: "Start the server",
    name: "start-server",
  },
  startupSteps: [
    buildSchema,
    createApplication,
    startServer,
  ],
});

// Build the schema
async function buildSchema(loader) {
  console.log("Building schema...");
  const builder = new SchemaBuilder();
  await builder.importFrom(loader.getSettingOrEnv("schema-path", "./schema"));
  loader.state.schema = builder.buildSchema();
}

// Create the application
async function createApplication(loader) {
  const schema = loader.state.schema;
  const app = loader.state.app = express();
  app.use("/graphql", graphql({ schema, graphiql: true }));
}

// Start server and return shutdown handler
async function startServer(loader) {
  console.log("Opening server...");
  const app = loader.state.app;
  const port = loader.getSettingOrEnv("port", 3000);
  const server = loader.state.server = createServer(app);
  await promisify(server.listen.bind(server))(port);
  console.log("Server started, listening on port %s", port);
  return async () => {
    console.log("Closing server...");
    await promisify(server.close.bind(server))();
    console.log("Server closed.");
  };
}
```

## Documentation

The documentation is not available for now, but if you use TypeScript, the
definitions are available with some (short) descriptions. There are also some
examples above for how you could use this library.

## Typescript

This module includes a [TypeScript](https://www.typescriptlang.org/)
declaration file to enable auto complete in compatible editors and type
information for TypeScript projects. This module depends on the Node.js
types, so install `@types/node`:

```sh
npm install --save-dev @types/node
```

## Changelog and versioning

All notable changes to this project will be documented in [changelog.md](./changelog.md).

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## License

This project is licensed under the MIT license. See [license](./license) for the
full terms.
