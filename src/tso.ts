#!/usr/bin/env node

import { Project, Node } from "ts-morph";
import { SyntaxKind } from "@ts-morph/common";
import * as format from 'prettier-eslint';
import * as fs from "fs";

const project = new Project({});
const sourceFiles = project.addSourceFilesAtPaths(["**/*.module.ts"]);

for (const sourceFile of sourceFiles) {
  const classDec = sourceFile.forEachChild(node => {
    if (Node.isClassDeclaration(node)) return node;
    return undefined;
  });

  const decorators = classDec.getDecorators();

  const objectLiteralExpression = decorators[0]
    .getFirstChildByKind(SyntaxKind.CallExpression)
    .getFirstChildByKind(SyntaxKind.ObjectLiteralExpression);

  objectLiteralExpression.forEachChild(node => {
    if (Node.isPropertyAssignment(node)) {
      const arrayLiteralExpression = node.getFirstChildByKind(
        SyntaxKind.ArrayLiteralExpression
      );
      const initialArray = [];
      arrayLiteralExpression.forEachChild(node => {
        if (Node.isIdentifier(node)) {
          initialArray.push(node.getText());
          arrayLiteralExpression.removeElement(node);
        }
      });
      const sorted = initialArray.sort((a, b) => {
        if (a.length < b.length) {
          return -1;
        }
        if (a.length > b.length) {
          return 1;
        }
        if (a.length === b.length) {
          return a.localeCompare(b);
        }
      });
      arrayLiteralExpression.insertElements(0, sorted);
    }
  });

  const options = {
    text: sourceFile.getFullText(),
    eslintConfig: {
      "env": {
        "browser": true,
        "es6": true
      },
      "globals": {
        "Atomics": "readonly",
        "SharedArrayBuffer": "readonly"
      },
      "parser": "@typescript-eslint/parser",
      "parserOptions": {
        "ecmaVersion": 2018,
        "sourceType": "module"
      },
      "rules": {
        "indent": ["error", 2],
        "array-bracket-newline": [
          "error",
          {
            "minItems": 2
          }
        ],
        "array-element-newline": [
          "error",
          {
            "multiline": true,
            "minItems": 1
          }
        ]
      }
    },
    prettierOptions: {
      parser: "typescript",
      bracketSpacing: true
    },
    fallbackPrettierOptions: {
      singleQuote: true
    }
  };

  const formatted = format(options);

  fs.writeFile(sourceFile.getFilePath(), formatted, err => {
    if (err) throw err;
  });
}
