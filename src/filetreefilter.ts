/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import shell from "shelljs";
import minimatch from "minimatch";

const Minimatch = minimatch.Minimatch;
type Minimatch = minimatch.Minimatch;


interface PatternSet {
  acceptMatchers: Minimatch[];
  rejectMatchers: Minimatch[];
}

export type ResultCallback = (path: string, accept: boolean) => void;


export class FileTreeFilter {

  #patternSets: PatternSet[] = [];
  #resultCallback: ResultCallback = null;

  constructor(resultCallback: ResultCallback) {
    this.#resultCallback = resultCallback;
  }

  addPattern(acceptList: string[], rejectList: string[]): void {
    this.#patternSets.push({
      acceptMatchers: acceptList.map(p => new Minimatch(p, {})),
      rejectMatchers: rejectList.map(p => new Minimatch(p, {}))
    });
  }

  run(dir: string): void {
    for (const itemPath of shell.find(dir)) {
      if ( ! shell.test('-f', itemPath)) {
        continue;
      }
      this.#resultCallback(itemPath, this.#isAccept(itemPath));
    }
  }

  #isAccept(path: string): boolean {
    for (const patternSet of this.#patternSets) {
      if (this.#matchPatternSet(path, patternSet)) {
        return true;
      }
    }
    return false;
  }

  #matchPatternSet(path: string, patternSet: PatternSet): boolean {
    let isMatch = false;
    for (const matcher of patternSet.acceptMatchers) {
      if (matcher.match(path)) {
        isMatch = true;
        break;
      }
    }

    if ( ! isMatch) {
      return false;
    }

    for (const matcher of patternSet.rejectMatchers) {
      if (matcher.match(path)) {
        return false;
      }
    }
    return true;
  }
}
