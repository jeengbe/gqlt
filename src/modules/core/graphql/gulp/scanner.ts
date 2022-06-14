import type { WatchType } from "@gulp/backend/builder";
import { areTypesEqual, getModuleScopeFileName, isModuleApiFile, isModuleFile, isNodeModule, not, or } from "@gulp/backend/utils";
import ts from "typescript";
import type { Schema, SchemaArgument, SchemaOutputType, SchemaScalar, SchemaType } from "../generated/schema";

export enum UpdateResult {
  /**
   * Nothing changed, do not recompile
   */
  NOTHING = 0,
  /**
   * Parameters or arguments changed, recompile schema only
   */
  SCHEMA = 1,
  /**
   * New types or scalars added, recompile everything
   */
  FULL = 2
}

export class Scanner {
  protected types: Schema;
  protected typesRegexes: [RegExp, string][];

  protected nodeUtils: NodeUtils;

  protected program: ts.Program;
  protected checker: ts.TypeChecker;
  protected sourceFiles: ts.SourceFile[];

  constructor(
    protected watch: WatchType
  ) {
    // We always provide `Query` and `Mutation`
    this.types = {
      Query: {
        kind: "type",
        name: "Query",
        description: "The root query type",
        fields: {},
        staticFields: {},
        from: []
      },
      Mutation: {
        kind: "type",
        name: "Mutation",
        description: "The root mutation type",
        fields: {},
        staticFields: {},
        from: []
      }
    };

    this.program = this.watch.getCurrentProgram().getProgram();
    this.checker = this.program.getTypeChecker();
    this.sourceFiles = this.program.getSourceFiles().filter(not(isNodeModule));

    this.nodeUtils = new NodeUtils(this.checker);

    // Initially scan for scalars and types, and also build regexes
    this.scanScalars();
    this.scanTypes();
    this.typesRegexes = this.buildTypesRegexes();
  }

  getTypes() {
    return this.types;
  }

  /**
   * Replace all references to types with proxied `__classes`-calls
   */
  replace(content?: string) {
    if (!content) return content;
    return this.typesRegexes.reduce((c, [rex, replace]) => c.replace(rex, replace), content);
  }

  protected buildTypesRegexes(): typeof this.typesRegexes {
    return [
      [new RegExp(`new (${Object.keys(this.types).join("|")})`, "g"), "new __classes.$1"],
      [new RegExp(`(${Object.keys(this.types).join("|")})\\.`, "g"), "__classes.$1."]
    ];
  }

  refreshTypes(sourceFile?: ts.SourceFile): UpdateResult {
    if (!sourceFile) return UpdateResult.NOTHING;
    return Math.max(this.updateScalars(sourceFile), this.updateTypes(sourceFile));
  }

  protected scanScalars() {
    for (const sourceFile of this.sourceFiles) {
      this.updateScalars(sourceFile);
    }
  }

  protected updateScalars(sourceFile: ts.SourceFile): UpdateResult {
    if (!isModuleFile(sourceFile.fileName)) return UpdateResult.NOTHING;

    // We handle this in three steps
    // First, find all scalars currently in the file and compare our findings with previous entries to return whether something worth reloading changed
    // ???
    // Step 3: PROFIT!!!

    const moduleFileName = getModuleScopeFileName(sourceFile.fileName);
    const scalars: Record<string, SchemaScalar> = {};

    for (const aliasDeclaration of sourceFile.statements.filter(ts.isTypeAliasDeclaration)) {
      const scalarName = aliasDeclaration.name.text;
      const { type } = aliasDeclaration;

      if (!ts.isTypeReferenceNode(type)) continue;
      // TODO: Check for actual symbol
      if (!ts.isIdentifier(type.typeName) || type.typeName.text !== "Scalar") continue;

      try {
        scalars[scalarName] = {
          kind: "scalar",
          name: scalarName,
          description: this.nodeUtils.getNodeDescription(aliasDeclaration),
          type: this.nodeUtils.getTypeNodeOutputType(type.typeArguments![0]),
          from: moduleFileName
        };
      } catch (e) {
        console.error(e);
        throw new ScanError(null, moduleFileName, scalarName);
      }
    }

    let result = UpdateResult.NOTHING;
    const oldScalars: Record<string, SchemaScalar> = {};

    // First we delete all old scalars from this file. This way, we don't need to worry about conflicts with the previous scan of the same file.
    // Then we simply push all found scalars. Deleted scalars are automatically deletes this way.

    for (const [scalarName, oldScalar] of Object.entries(this.types)) {
      if (oldScalar.kind === "scalar" && oldScalar.from === moduleFileName) {
        delete this.types[scalarName];
        oldScalars[scalarName] = oldScalar;
      }
    }

    for (const scalarName in scalars) {
      const scalar = scalars[scalarName];

      if (scalarName in this.types) {
        throw new ScanError("Duplicate scalar name", moduleFileName, scalarName);
      }

      if (!areTypesEqual(Object.entries(oldScalars).find(([oldScalarName]) => oldScalarName === scalarName)?.[1], scalar)) {
        // New scalar is not equal to the previous entry, something changed
        // Update the schema only
        result = UpdateResult.SCHEMA;
      }

      this.types[scalarName] = scalar;
    }

    // Force all files to recompile if any scalars were added/removed
    if (Object.keys(oldScalars).length !== Object.keys(scalars).length) {
      result = UpdateResult.FULL;
    } else {
      for (const scalar in scalars) {
        if (!(scalar in oldScalars)) {
          result = UpdateResult.FULL;
          break;
        }
      }
    }

    return result;
  }

  protected scanTypes() {
    for (const sourceFile of this.sourceFiles) {
      this.updateTypes(sourceFile);
    }
  }

  protected updateTypes(sourceFile: ts.SourceFile): UpdateResult {
    if (!isModuleApiFile(sourceFile.fileName)) return UpdateResult.NOTHING;

    // Same idea for types as for scalars: first scan, then update

    const moduleFileName = getModuleScopeFileName(sourceFile.fileName);
    const types: Record<string, SchemaType> = {};

    for (const classOrInterfaceDeclaration of sourceFile.statements) {
      if (!(ts.isClassDeclaration(classOrInterfaceDeclaration) || ts.isInterfaceDeclaration(classOrInterfaceDeclaration))) continue;
      if (!this.nodeUtils.isNodeExported(classOrInterfaceDeclaration)) continue;

      const typeName = classOrInterfaceDeclaration.name?.text;
      if (!typeName) continue;

      types[typeName] = {
        kind: "type",
        name: typeName,
        fields: {},
        staticFields: {},
        description: this.nodeUtils.getNodeDescription(classOrInterfaceDeclaration),
        from: [moduleFileName]
      };

      const type = types[typeName];

      for (const member of classOrInterfaceDeclaration.members) {
        // We only collect fields from this set of nodes
        if (!(ts.isMethodDeclaration(member) || ts.isGetAccessor(member) || ts.isPropertySignature(member))) continue;
        // Fields may have different names in GraphQL (see implementation for details), so we need to track both
        const docTags = this.nodeUtils.getDocTags(member);

        const internal = Boolean(docTags.find(tag => tag.name === "internal"));
        const { name: fieldName, member: memberName } = this.nodeUtils.getFieldName(member);
        if (!fieldName) continue;
        if (memberName === "save") continue; // `save` is a reserved method name for saving objects to db

        // Store static fields separately from regular fields
        if (member.modifierFlagsCache & ts.ModifierFlags.Static) {
          type.staticFields[memberName] = {
            kind: "staticField",
            name: memberName,
            from: [moduleFileName]
          };
        } else {
          try {
            type.fields[memberName] = {
              kind: "field",
              name: fieldName,
              description: this.nodeUtils.getNodeDescription(member),
              type: this.nodeUtils.getNodeOutputType(member),
              // Map parameters to their respective schema representations (order matters!)
              args: ts.isMethodDeclaration(member)
                ? member.parameters.reduce((params, p) => {
                  if (!ts.isIdentifier(p.name)) return params;
                  const parameteName = p.name.text;

                  params[parameteName] = {
                    kind: "argument",
                    name: parameteName,
                    description: this.nodeUtils.getNodeDescription(p),
                    type: this.nodeUtils.getNodeOutputType(p)
                  };
                  return params;
                }, {} as Record<string, SchemaArgument>)
                : {},
              resolve: {
                // We need to remember whether each field is a method or property, as this matters in runtime
                // Again, parameter order matters as we map parameters based on this information
                args: ts.isMethodDeclaration(member)
                  ? member.parameters.map(p => p.name).filter(ts.isIdentifier).map(n => n.text)
                  : false,
                file: moduleFileName,
                internal
              }
            };
          } catch (e) {
            if (e instanceof Error) {
              throw new ScanError(e.message, moduleFileName, typeName, fieldName);
            }
            throw e;
          }
        }
      }
    }

    let result = UpdateResult.NOTHING;
    // We track updated types so we can decide to which extent to update files
    const updatedTypes: string[] = [];

    // This is done differently:
    // We iterate all current types and
    // - if it no longer exists in the current file, remove all references to it
    // - if it still exists, update fields and static fields

    for (const [typeName, oldType] of Object.entries(this.types)) {
      if (oldType.kind !== "type") continue;

      if (!(typeName in types)) {
        // Not is and never was in the current file: safe to ignore
        if (!oldType.from.includes(moduleFileName)) continue;

        result = UpdateResult.FULL;
        // Type only existed in this file
        if (oldType.from.length === 1) {
          delete this.types[typeName];
          continue;
        }

        // Remove all references to file
        Object.assign(oldType, {
          from: oldType.from.filter(f => f !== moduleFileName),
          fields: Object.entries(oldType.fields).reduce<typeof oldType.fields>((fields, [fieldName, field]) => {
            if (field.resolve.file === moduleFileName) return fields;
            fields[fieldName] = field;

            return fields;
          }, {}),
          staticFields: Object.entries(oldType.staticFields).reduce<typeof oldType.staticFields>((fields, [fieldName, field]) => {
            if (field.from.includes(moduleFileName)) {
              field.from = field.from.filter(from => from !== moduleFileName);
            }
            if (field.from.length) {
              fields[fieldName] = field;
            }

            return fields;
          }, {})
        });
        oldType.from = oldType.from.filter(from => from !== moduleFileName);
      } else {
        // Update types
        const type = types[typeName];
        const dealtWithFields: string[] = [];
        const dealtWithStaticFields: string[] = [];

        // To update (static) fields, we first iterate all currently set fields and check whether they need to be updated
        // Then, we push all new fields that weren't dealt with in the previous step

        Object.assign(oldType, {
          description: type.description,
          // eslint-disable-next-line @typescript-eslint/no-loop-func
          fields: Object.entries(oldType.fields).reduce<typeof oldType.fields>((fields, [fieldName, oldField]) => {
            if (fieldName in type.fields) {
              // Field existed and exists: Update
              const field = type.fields[fieldName];

              if (oldField.resolve.file !== moduleFileName) {
                throw new ScanError("Field is already defined", moduleFileName, typeName, fieldName);
              }
              if (!areTypesEqual(oldField, field)) {
                result = Math.max(result, UpdateResult.SCHEMA);
                oldField = field;
              }
              dealtWithFields.push(fieldName);
              fields[fieldName] = oldField;
            } else if (oldField.resolve.file !== moduleFileName) {
              // Don't bother if field is defined in a different file
              // Else, delete it (by not including it anymore)
              fields[fieldName] = oldField;
            }
            return fields;
          }, {}),
          // eslint-disable-next-line @typescript-eslint/no-loop-func
          staticFields: Object.entries(oldType.staticFields).reduce<typeof oldType.staticFields>((fields, [fieldName, oldField]) => {
            // Slightly different procedure for static fields:
            // If it still exists, we push the current file name on the resolution stack
            // Else, we simply remove the current file
            if (fieldName in type.staticFields) {
              if (!oldField.from.includes(moduleFileName)) {
                oldField.from.push(moduleFileName);
                dealtWithStaticFields.push(fieldName);
                result = Math.max(result, UpdateResult.SCHEMA);
              }
            } else {
              oldField.from = oldField.from.filter(from => from !== moduleFileName);
              result = Math.max(result, UpdateResult.SCHEMA);
            }
            // Only bother adding the field if it has at least one handler
            if (oldField.from.length) {
              fields[fieldName] = oldField;
            }
            return fields;
          }, {})
        });

        // Push new fields
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        Object.assign(oldType.fields, Object.entries(type.fields).reduce<typeof oldType.fields>((fields, [fieldName, field]) => {
          if (dealtWithFields.includes(fieldName)) return fields;
          fields[fieldName] = field;
          result = Math.max(result, UpdateResult.SCHEMA);
          return fields;
        }, {}));
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        Object.assign(oldType.staticFields, Object.entries(type.staticFields).reduce<typeof oldType.staticFields>((fields, [fieldName, field]) => {
          if (dealtWithStaticFields.includes(fieldName)) return fields;
          fields[fieldName] = field;
          result = Math.max(result, UpdateResult.SCHEMA);
          return fields;
        }, {}));

        // If we contribute fields, we are entitled to a mention if the type's `from` list
        if (Object.keys(type.fields).length || Object.keys(type.staticFields).length) {
          if (!oldType.from.includes(moduleFileName)) {
            oldType.from.push(moduleFileName);
          }
        }

        updatedTypes.push(typeName);
      }
    }

    // Request a full recompilation if we added or removed types
    for (const typeName in types) {
      if (!updatedTypes.includes(typeName)) {
        result = UpdateResult.FULL;
        this.types[typeName] = types[typeName];
      }
    }

    return result;
  }
}

class NodeUtils {
  constructor(
    protected checker: ts.TypeChecker
  ) { }

  isNodeExported(node: ts.Node): boolean {
    return (
      (ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0 ||
      (Boolean(node.parent) && node.parent.kind === ts.SyntaxKind.SourceFile)
    );
  }

  getNodeDescription(node: ts.NamedDeclaration): string | undefined {
    const symbol = node.name && this.checker.getSymbolAtLocation(node.name);
    if (symbol === undefined) throw new Error(`Could not get symbol for node ${node.name}`);

    return ts.displayPartsToString(symbol.getDocumentationComment(this.checker));
  }

  getNodeOutputType(node: ts.NamedDeclaration) {
    const symbol = node.name && this.checker.getSymbolAtLocation(node.name);
    if (symbol === undefined) throw new Error(`Could not get symbol for node ${node.name}`);
    const symbolType = this.checker.getTypeOfSymbolAtLocation(symbol, node);
    const typeNode = this.checker.typeToTypeNode(symbolType, node, ts.NodeBuilderFlags.None)!;

    return this.getTypeNodeOutputType(typeNode);
  }

  getTypeNodeOutputType(type: ts.TypeNode, isNullable = false): SchemaOutputType {
    switch (type.kind) {
      // case ts.SyntaxKind.StringLiteral:
      case ts.SyntaxKind.StringKeyword:
        // `String` scalar
        return this.nonNull({
          kind: "type",
          name: "string"
        }, isNullable);

      // case ts.SyntaxKind.TrueKeyword:
      // case ts.SyntaxKind.FalseKeyword:
      case ts.SyntaxKind.BooleanKeyword:
        // `Boolean` scalar
        return this.nonNull({
          kind: "type",
          name: "boolean"
        }, isNullable);

      // case ts.SyntaxKind.NumericLiteral:
      case ts.SyntaxKind.NumberKeyword:
        // JavaScript `number` is ambiguous as it could both be `Float` or `Integer`
        throw new Error("Number literals are not supported! Use `integer` or `float` from `@core/scalars` instead.");

      case ts.SyntaxKind.FunctionType:
        // Resolve function return types
        return this.getTypeNodeOutputType((type as ts.FunctionOrConstructorTypeNode).type);

      case ts.SyntaxKind.TypeReference:
        // We have a type reference
        const typeReference = type as ts.TypeReferenceNode;
        if ((typeReference.typeName as ts.Identifier).text === "Promise") {
          // If the type is a promise, return the promise's type
          return this.getTypeNodeOutputType(typeReference.typeArguments![0]);
        }
        return this.nonNull({
          kind: "type",
          name: (typeReference.typeName as ts.Identifier).text
        }, isNullable);

      case ts.SyntaxKind.ArrayType:
        return this.nonNull({
          kind: "array",
          of: this.getTypeNodeOutputType((type as ts.ArrayTypeNode).elementType)
        }, isNullable);

      case ts.SyntaxKind.UnionType:
        const unionType = type as ts.UnionTypeNode;
        if (unionType.types.length === 2 && unionType.types.filter(or(this.isNullLiteral, this.isUndefined)).length === 1) {
          return this.getTypeNodeOutputType(unionType.types.find(not(or(this.isNullLiteral, this.isUndefined)))!, true);
        }
        throw new Error("Union types are not supported!");

      case ts.SyntaxKind.VoidKeyword:
        return this.nonNull({
          kind: "type",
          name: "void"
        }, true);

      default:
        console.error(type);
        throw new Error(`Unsupported type: ${ts.SyntaxKind[type.kind]}`);
    }
  }

  nonNull<T extends SchemaOutputType>(type: T, isNullable: boolean) {
    if (isNullable) {
      return type;
    }
    return {
      kind: "nonNull" as const,
      of: type
    };
  }

  isNullLiteral(this: void, type: ts.TypeNode) {
    return type.kind === ts.SyntaxKind.LiteralType && (type as ts.LiteralTypeNode).literal.kind === ts.SyntaxKind.NullKeyword;
  }

  isUndefined(this: void, type: ts.TypeNode) {
    return type.kind === ts.SyntaxKind.UndefinedKeyword;
  }

  getFieldName(member: ts.MethodDeclaration | ts.GetAccessorDeclaration | ts.PropertySignature) {
    if (!ts.isIdentifier(member.name)) return { member: undefined, name: undefined };
    const docTag = this.getDocTags(member).find(tag => tag.name === "gqlField");
    return docTag?.text
      ? {
        member: member.name.text,
        name: ts.displayPartsToString(docTag.text)
      }
      : {
        member: member.name.text,
        name: member.name.text.replace(/^get(?<firstChar>[A-Z])/, (_, match) => match.toLowerCase())
      };
  }

  getDocTags(member: ts.MethodDeclaration | ts.GetAccessorDeclaration | ts.PropertySignature) {
    const symbol = this.checker.getSymbolAtLocation(member.name);
    if (symbol === undefined) throw new Error(`Could not get symbol for node ${"text" in member.name ? member.name.text : "anonymous"}`);
    return symbol.getJsDocTags(this.checker);
  }
}

export class ScanError extends Error {
  constructor(
    message: string | null,
    private readonly _fileName: string,
    private readonly _typeName: string,
    private readonly _fieldName?: string
  ) {
    super(message ?? undefined);
  }

  get fileName() {
    return this._fileName;
  }

  get typeName() {
    return this._typeName;
  }

  get fieldName() {
    return this._fieldName;
  }
}
