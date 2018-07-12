# graphql-schema-builder

A simple GraphQL schema builder

## Usage

Simple builder factory.

```js
import SchemaBuilder from "schema-builder";

async function buildSchema(schemaFolder) {
  const builder = new SchemaBuilder(["Query", "Mutation", "Subscription"]);
  await builder.importFrom(schemaFolder);
  return builder.getSchema();
}
```

Simple program example. See [program](.) for more info.

```js
import { join } from "path";
import Program from "program";
import SchemaBuilder from "schema-builder";

const builder = new SchemaBuilder(["Query", "Mutation", "Subscription"]);

new Program("graphql-schema-builder-example", {defaults: {schemaPath: "../schema"}})
  .addStartupSteps(
    (program) => builder.importFrom(program.getSetting("schemaPath")),
    (program) => createApplication(program, builder.getSchema()),
  )
  .start()
;

async function createApplication(program, schema) {
  console.info("starting application");
  /* magically create a graphql application/server */
  return () => console.info("stopping application");
}
```

## Documentation

The documentation is not yet available.
