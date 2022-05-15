// This has to run first to reliably set cwd correctly for dotenv etc.
/*
 * BEGIN ORDER MATTERS
 */
/*
 * END ORDER MATTERS
 */
import { __core } from "@paths";
import cors from "cors";
import "dotenv/config";
import express from "express";
import { graphqlHTTP } from "express-graphql";
import * as fs from "fs";
import type { GraphQLFieldResolver, GraphQLNullableType, GraphQLOutputType, GraphQLType } from "graphql";
import { GraphQLBoolean, GraphQLFloat, GraphQLID, GraphQLInt, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLScalarType, GraphQLSchema, GraphQLString } from "graphql";
import * as path from "path";
import "source-map-support/register";
import { init, root } from "./classes";
import type { Schema, SchemaOutputType } from "./schema";
import { ValidationError } from "./utils";
process.chdir(path.resolve(__dirname, "..", ".."));

const schema = JSON.parse(fs.readFileSync(path.resolve(__core, "generated/schema.json"), "utf-8")) as Schema;

function array<T extends GraphQLType>(type: T) {
  return new GraphQLList(type);
}

function nonNull<T extends GraphQLNullableType>(type: T) {
  return new GraphQLNonNull(type);
}

function resolve(field: string, functionArgs: string[] | false = false) {
  return (async (source, args) => {
    if (functionArgs !== false) {
      // Is callable
      return await source[field](...functionArgs.map(arg => args[arg]));
    }
    // Not callable
    return await source[field];
  }) as GraphQLFieldResolver<any, any, any>;
}

const types = {
  string: GraphQLString,
  integer: GraphQLInt,
  float: GraphQLFloat,
  boolean: GraphQLBoolean,
  id: GraphQLID,
  void: new GraphQLScalarType({
    name: "Void",
    description: "The `Void` scalar is used to indicate that a mutation returns nothing. It is returned as `null`."
  })
} as Record<string, any>;

function convertType(type: SchemaOutputType): GraphQLOutputType {
  if (type.kind === "nonNull") {
    return nonNull(convertType(type.of));
  } else if (type.kind === "array") {
    return array(convertType(type.of));
  }
  return types[type.name];
}

for (const name in schema) {
  const type = schema[name];

  switch (type.kind) {
    case "scalar":
      types[name] = new GraphQLScalarType({
        name: type.name,
        description: type.description
      });
      break;
    case "type":
      types[name] = new GraphQLObjectType({
        name: type.name,
        description: type.description,
        fields: () => Object.entries(type.fields).reduce<Record<string, any>>((fields, [memberName, field]) => {
          fields[field.name] = {
            type: convertType(field.type),
            description: field.description,
            resolve: resolve(memberName, field.resolve.args),
            args: Object.values(field.args).reduce<Record<string, any>>((args, arg) => {
              args[arg.name] = {
                type: convertType(arg.type),
                description: arg.description
              };
              return args;
            }, {})
          };
          return fields;
        }, {})
      });
      break;
  }
}

void init().then(() => {
  const app = express();

  app.use(cors());
  app.use(
    graphqlHTTP({
      schema: new GraphQLSchema({
        query: types.Query,
        mutation: types.Mutation
      }),
      graphiql: true,
      rootValue: root,
      customFormatErrorFn: (error) => {
        if (!(error.originalError instanceof ValidationError)) {
          console.log(error);
        }
        return error;
      }
    })
  );

  app.listen(4000);
});
