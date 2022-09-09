/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import shell from "shelljs";
import { FileTreeFilter } from "./filetreefilter";


test("Filter filetree1", done => {
  const acceptList: string[] = [];
  const rejectList: string[] = [];

  const resultCallback = (path: string, accept: boolean): void => {
    if (accept) {
      acceptList.push(path);
    } else {
      rejectList.push(path);
    }
  };
  const filter = new FileTreeFilter(resultCallback);
  filter.addPattern(["README.md", "logo.png"], []);
  filter.addPattern(["src/*.js"], ["src/*.jest.js"]);
  filter.addPattern(["**/info.txt"], []);
  filter.addPattern(["**/note.txt"], []);
  filter.addPattern([], ["**/note.txt"]);

  shell.cd("fixtures/filetree1");
  filter.run(".");

  console.log("Accept list: ");
  console.log(acceptList);

  console.log("Reject list: ");
  console.log(rejectList);

  expect(acceptList.length).toBe(5);
  expect(acceptList.includes("README.md")).toBe(true);
  expect(acceptList.includes("logo.png")).toBe(true);
  expect(acceptList.includes("src/code.js")).toBe(true);
  expect(acceptList.includes("info.txt")).toBe(true);
  expect(acceptList.includes("src/info.txt")).toBe(true);

  expect(rejectList.length).toBe(3);
  expect(rejectList.includes(".dotfile")).toBe(true);
  expect(rejectList.includes("src/code.jest.js")).toBe(true);
  expect(rejectList.includes("note.txt")).toBe(true);

  done();
});
