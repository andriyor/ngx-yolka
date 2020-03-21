#!/usr/bin/env node

import { Project, Node } from "ts-morph";
import { SyntaxKind } from "@ts-morph/common";
import * as format from 'prettier-eslint';
const prettier = require("prettier");
import * as fs from "fs";
const fg = require('fast-glob');

const posthtml = require('posthtml');
const attrsSorter = require('posthtml-attrs-sorter');

const project = new Project({});
const sourceFiles = project.addSourceFilesAtPaths(["**/*.module.ts"]);
const dtoFiles = project.addSourceFilesAtPaths(["**/*.dto.ts"]);

const compareLength = (a, b) => {
  if (a.length < b.length) {
    return -1;
  }
  if (a.length > b.length) {
    return 1;
  }
  if (a.length === b.length) {
    return a.localeCompare(b);
  }
};

const eslintConfig = {
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
};


for (const sourceFile of sourceFiles) {
  const classDec = sourceFile.forEachChild(node => {
    if (Node.isClassDeclaration(node)) return node;
    return undefined;
  });

  if (classDec) {
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
        const sorted = initialArray.sort(compareLength);
        arrayLiteralExpression.insertElements(0, sorted);
      }
    });

    const options = {
      text: sourceFile.getFullText(),
      eslintConfig: eslintConfig,
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
}

for (const dtoFile of dtoFiles) {
  const classDec = dtoFile.forEachChild(node => {
    if (Node.isClassDeclaration(node)) return node;
    return undefined;
  });

  if (classDec) {

    const structures = [];
    for (const property of classDec.getProperties()) {
      structures.push(property.getStructure());
      property.remove();
    }

    const sorted = structures.sort((a, b) => {
      if ((a.name + a.type).length < (b.name + b.type).length) {
        return -1;
      }
      if ((a.name + a.type).length > (b.name + b.type).length) {
        return 1;
      }
      if ((a.name + a.type).length === (b.name + b.type).length) {
        return a.name.localeCompare(b.name);
      }
    });
    classDec.addProperties(sorted);

    const constructor = classDec.getFirstChildByKind(SyntaxKind.Constructor);
    constructor.setOrder(classDec.getProperties().length);

    const block = constructor.getFirstChildByKind(SyntaxKind.Block);
    const statements = [];
    block.forEachChild(node => {
      if (Node.isExpressionStatement(node)) {
        statements.push(node.getText());
      }
    });
    block.removeText();

    const sortedStatements = statements.sort(compareLength);

    block.addStatements(sortedStatements);

    const options = {
      text: dtoFile.getFullText(),
      eslintConfig: eslintConfig,
      prettierOptions: {
        parser: "typescript",
        bracketSpacing: true
      },
      fallbackPrettierOptions: {
        singleQuote: true
      }
    };

    const formatted = format(options);

    fs.writeFile(dtoFile.getFilePath(), formatted, err => {
      if (err) throw err;
    });
  }
}

const fileNames = fg.sync(['**.html', '!**/node_modules'], { dot: true });

const directive = String.raw`\*\w+`;
const variables = String.raw`\#\w+`;
const banana = String.raw`[^\[]\w+\)(?!\])`;
const box = String.raw`\[(\w*)\]`;
const bananaInTheBox =  String.raw`\[\(\w*\)\]`;

const orderConfig = {
  "order": [
    directive,
    variables,
    "id",
    "class",
    "$unknown$",
    "name",
    "data-.+",
    "src",
    "for",
    "type",
    "href",
    "values",
    "title",
    "alt",
    "role",
    "aria-.+",
    banana,
    box,
    bananaInTheBox
  ]
}

for (const fileName of fileNames) {
  const htmlRaw = fs.readFileSync(fileName,  "utf8");
  posthtml()
    .use(attrsSorter(orderConfig))
    .process(htmlRaw)
    .then(function(result) {
      const fromatted = prettier.format(result.html, { parser: "html" });
      fs.writeFileSync(fileName, fromatted);
    })
}
