import * as path from "path";
import ts from "typescript";
import type { Schema, SchemaArgument, SchemaOutputType, SchemaType } from "../src/core/schema";
import { __src } from "./compile";
import { getModuleApiSourceFiles } from "./utils";

export function scan(options: ts.CreateProgramOptions): Schema {
  const program = ts.createProgram(options);

  const checker = program.getTypeChecker();

  const moduleApiSourceFiles = getModuleApiSourceFiles(program.getSourceFiles());

  const types: Schema = {};

  // Collect Scalars
  for (const sourceFile of moduleApiSourceFiles) {
    if (!sourceFile.isDeclarationFile || !sourceFile.fileName.startsWith(path.resolve(__src, "modules"))) continue;

    for (const aliasDeclaration of sourceFile.statements.filter(ts.isTypeAliasDeclaration)) {
      const scalarName = aliasDeclaration.name.text;

      if (scalarName in types) {
        throw new Error(`Duplicate scalar name: ${scalarName}`);
      }

      const type = aliasDeclaration.type;
      if (!ts.isTypeReferenceNode(type)) continue;
      if ((type.typeName as ts.Identifier).text !== "Scalar") continue;

      try {
        types[scalarName] = {
          kind: "scalar",
          name: scalarName,
          description: getNodeDescription(aliasDeclaration),
          type: getTypeNodeOutputType(type.typeArguments![0])
        };
      } catch (e) {
        console.error(`Error while parsing scalar ${scalarName} in ${sourceFile.fileName}:`);
        throw e;
      }
    }
  }

  // Collect Types
  for (const sourceFile of moduleApiSourceFiles) {
    const fileName = sourceFile.fileName.substring((__src + "/modules/").length, sourceFile.fileName.length - 3).replace(/\\/g, "/");

    for (const classDeclaration of sourceFile.statements.filter(ts.isClassDeclaration).filter(isNodeExported)) {
      const typeName = classDeclaration.name?.text;
      if (typeName === undefined) continue;

      if (!(typeName in types)) {
        types[typeName] = {
          kind: "type",
          name: typeName,
          fields: {},
          description: getNodeDescription(classDeclaration),
          from: [fileName]
        };
      } else {
        const type = types[typeName];
        if (type.kind === "scalar") throw new Error(`Type "${typeName}" is already defined as a scalar type`);
        if (getNodeDescription(classDeclaration) !== "") throw new Error(`Type "${typeName}" already has a description`);
        if (!type.from.includes(fileName)) type.from.push(fileName);
      }
      const type = types[typeName] as SchemaType;

      for (const member of classDeclaration.members.filter(m => ts.isMethodDeclaration(m) || ts.isGetAccessor(m))) {
        const fieldName = (member.name as ts.Identifier)?.text;
        if (fieldName in type.fields) {
          throw new Error(`Field "${fieldName}" is already defined in type "${typeName}"`);
        }

        try {
          type.fields[fieldName] = {
            kind: "field",
            name: fieldName,
            description: getNodeDescription(member),
            type: getNodeOutputType(member),
            args: member.kind === ts.SyntaxKind.MethodDeclaration ? (member as ts.MethodDeclaration).parameters.reduce((parameters, p) => {
              const parameterName = (p.name as ts.Identifier).text;

              parameters[parameterName] = {
                kind: "argument",
                name: parameterName,
                description: getNodeDescription(p),
                type: getNodeOutputType(p),
              };
              return parameters;
            }, {} as Record<string, SchemaArgument>) : {},
            resolve: {
              args: member.kind === ts.SyntaxKind.MethodDeclaration ? (member as ts.MethodDeclaration).parameters?.map(p => (p.name as ts.Identifier).text) : false,
              from: fileName
            }
          };
        } catch (e) {
          console.error(`Error while parsing field "${fieldName}" in "${typeName}" in ${sourceFile.fileName}:`);
          throw e;
        }
      }
    }
  }

  return types;

  function isNodeExported(node: ts.Node): boolean {
    return (
      (ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0 ||
      (!!node.parent && node.parent.kind === ts.SyntaxKind.SourceFile)
    );
  }

  function getNodeDescription(node: ts.NamedDeclaration): string | undefined {
    const symbol = node.name && checker.getSymbolAtLocation(node.name);
    if (symbol === undefined) throw new Error(`Could not get symbol for node ${node.name}`);

    return ts.displayPartsToString(symbol.getDocumentationComment(checker));
  }

  function getNodeOutputType(node: ts.NamedDeclaration) {
    const symbol = node.name && checker.getSymbolAtLocation(node.name);
    if (symbol === undefined) throw new Error(`Could not get symbol for node ${node.name}`);
    const symbolType = checker.getTypeOfSymbolAtLocation(symbol, node);
    const typeNode = checker.typeToTypeNode(symbolType, node, ts.NodeBuilderFlags.None)!;

    return getTypeNodeOutputType(typeNode);
  }
}

function getTypeNodeOutputType(type: ts.TypeNode, isNullable = false): SchemaOutputType {
  if ([ts.SyntaxKind.StringLiteral, ts.SyntaxKind.StringKeyword].includes(type.kind)) {
    // `String` scalar
    return nonNull({
      kind: "type",
      name: "string",
    }, isNullable);
  }
  if ([ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.BooleanKeyword].includes(type.kind)) {
    // `Boolean` scalar
    return nonNull({
      kind: "type",
      name: "boolean"
    }, isNullable);
  }
  if ([ts.SyntaxKind.NumericLiteral, ts.SyntaxKind.NumberKeyword].includes(type.kind)) {
    // JavaScript `number` is ambiguous as it could both be `Float` or `Integer`
    throw new Error("Number literals are not supported! Use `integer` or `float` from `@core/scalars` instead.");
  }
  if (type.kind === ts.SyntaxKind.FunctionType) {
    // Resolve function return types
    return getTypeNodeOutputType((type as ts.FunctionOrConstructorTypeNode).type);
  }
  if (type.kind === ts.SyntaxKind.TypeReference) {
    // We have a type reference
    const typeReference = type as ts.TypeReferenceNode;
    if ((typeReference.typeName as ts.Identifier).text === "Promise") {
      // If the type is a promise, resolve the promise's type
      return getTypeNodeOutputType(typeReference.typeArguments![0]);
    }
    return nonNull({
      kind: "type",
      name: (typeReference.typeName as ts.Identifier).text,
    }, isNullable);
  }
  if (type.kind === ts.SyntaxKind.ArrayType) {
    return nonNull({
      kind: "array",
      of: getTypeNodeOutputType((type as ts.ArrayTypeNode).elementType)
    }, isNullable);
  }
  if (type.kind === ts.SyntaxKind.UnionType) {
    const unionType = type as ts.UnionTypeNode;
    if (unionType.types.length === 2 && unionType.types.filter(isNullLiteral).length === 1) {
      return getTypeNodeOutputType(unionType.types.find(t => !isNullLiteral(t))!, true);
    }
  }
  console.error(type);
  throw new Error(`Unsupported type: ${ts.SyntaxKind[type.kind]}`);
}

function nonNull<T>(type: T, isNullable: boolean) {
  if (isNullable) {
    return type;
  }
  return {
    kind: "nonNull" as const,
    of: type
  };
}

function isNullLiteral(type: ts.TypeNode) {
  return type.kind === ts.SyntaxKind.LiteralType && (type as ts.LiteralTypeNode).literal.kind === ts.SyntaxKind.NullKeyword;
}
