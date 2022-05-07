import { replaceTscAliasPaths } from "tsc-alias";
import ts from "typescript";
import type { Schema } from "../src/core/schema";
import { isModuleApiFile } from "./utils";

export function build(options: Omit<ts.CreateProgramOptions, "host">, types: Schema, tsconfigPath: string) {
  const host = ts.createCompilerHost(options.options);
  const realReadFile = host.readFile.bind(host);

  const typesRegex = new RegExp(`new (${Object.keys(types).join("|")})`, "g");

  host.readFile = (fileName: string) => {
    if (fileName.endsWith("core/generated/schema.json")) {
      return JSON.stringify(types, null, 2);
    } else if (isModuleApiFile(fileName)) {
      let content = realReadFile(fileName);
      content = content?.replace(typesRegex, `new __classes.$1`);

      return `import __classes from "@classes";
${content}`;
    } else {
      return realReadFile(fileName);
    }
  };

  const program = ts.createProgram({ ...options, host });
  const checker = program.getTypeChecker();

  program.emit(
    undefined,
    undefined,
    undefined,
    undefined,
    {
      before: [
        // (context) => {
        //   return node => {
        //     if (node.kind === ts.SyntaxKind.SourceFile) {
        //       if (isModuleApiFile(node)) {
        //         let sourceFile = node;
        //         let overwritten: string[] = [];

        //         function visit(node: ts.Node): ts.Node {
        //           if (ts.isNewExpression(node)) {
        //             if (ts.isIdentifier(node.expression)) {
        //               if (node.expression.text in types && types[node.expression.text].kind === "type") {
        //                 overwritten.push(node.expression.text);
        //                 return factory.updateNewExpression(
        //                   node,
        //                   factory.createPropertyAccessExpression(
        //                     factory.createIdentifier("__classes"),
        //                     factory.createIdentifier(node.expression.text)
        //                   ),
        //                   node.typeArguments,
        //                   node.arguments
        //                 );
        //               }
        //             }
        //           }
        //           return ts.visitEachChild(node, child => visit(child), context);
        //         }

        //         sourceFile = ts.visitNode(sourceFile, visit);
        //         ts.visitEachChild(sourceFile, node => {
        //           if (ts.isImportDeclaration(node)) {
        //             if (node.importClause === undefined) return node;
        //             // const symbol = checker.getSymbolAtLocation(node.moduleSpecifier);
        //             // TODO: Remove unused imports
        //           }
        //           return node;
        //         }, context);

        //         if (overwritten.length > 0) {
        //           return factory.updateSourceFile(sourceFile, [
        //             factory.createImportDeclaration(
        //               undefined,
        //               undefined,
        //               factory.createImportClause(
        //                 false,
        //                 factory.createIdentifier("__classes"),
        //                 undefined
        //               ),
        //               factory.createStringLiteral("@classes"),
        //               undefined
        //             ),
        //             ...sourceFile.statements
        //           ]);
        //         }
        //         return sourceFile;
        //       }
        //       return node;
        //     }
        //     throw new Error(`Unexpected node: ${ts.SyntaxKind[node.kind]}`);
        //   };
        // }
      ]
    }
  );

  replaceTscAliasPaths({
    configFile: tsconfigPath,
  });
}
