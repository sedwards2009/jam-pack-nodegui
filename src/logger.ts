/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export class Logger {

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

  section(msg: string): void {
    this.#log("");
    this.#log("\u25Ba " + msg);
  }

  subsection(msg: string): void {
    this.#log("    \u25Ba " + msg);
  }

  #log(msg: string): void {
    console.log(msg);
  }
}

