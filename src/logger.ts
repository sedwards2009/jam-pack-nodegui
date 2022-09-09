/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export class Logger {

  logText(text: string): void {
    this.#log(text);
  }

  info(msg: string): void {
    this.#log("        [i] " + msg);
  }

  error(msg: string): void {
    this.#log(msg);
  }

  checkOk(msg: string): void {
    this.#log("        ✅ " + msg);
  }

  checkError(msg: string): void {
    this.#log("        ❌ " + msg);
  }

  checkListOK(name: string, list: string[]): void {
    this.#log(`        ✅ '${name}' commands:`);
    for (const item of list) {
      this.#log("          \u2022 " + item);
    }
  }

  section(msg: string): void {
    this.#log("");
    this.#log("\u25Ba " + msg);
  }

  subsection(msg: string): void {
    this.#log("    \u25Ba " + msg);
  }

  keep(msg: string): void {
    this.#log("        ✅ " + msg);
  }

  prune(msg: string): void {
    this.#log("        ✂️ " + msg);
  }

  #log(msg: string): void {
    process.stdout.write("" +msg);
    process.stdout.write("\n");
  }
}

