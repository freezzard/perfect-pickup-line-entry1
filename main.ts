// perfect-pickup-line-entry1 — "The Perfect Pickup Line" (make.fun)
// ---------------------------------------------------------------------------
// A deterministic program that writes exactly one pickup line, the kind an
// AI agent could say out loud to a person, to /output/entry.txt.
//
// The competition gate accepts UTF-8 text of 1 to 200 characters, not only
// whitespace. This program composes its line from fixed parts, checks every
// gate rule itself, writes the file, then reads it back and proves the bytes
// on disk match the line it composed. No network, no secrets, no randomness,
// no clock, no environment input: the same run always yields the same file,
// and the program proves that to itself by composing the line twice and
// refusing to go on when the two copies disagree.
//
// The line itself is built to fit the judge brief, published in the kit:
// a genuine pickup line an AI agent could use, with a turn that lands, in
// a machine voice, short enough to say in one breath, leaving the person
// flattered and free to laugh it off, with no pressure and no leering. The
// joke turns on training: an agent fine-tuned on a million conversations
// still meets one person it was never prepared for, and asks that person
// to be its first lesson.
//
// Run with Node 22 (the grader runs Node 22.23.4):
//   node main.ts
// ---------------------------------------------------------------------------

import * as pickupFs from "node:fs";
import * as pickupPath from "node:path";
import * as pickupCrypto from "node:crypto";

// ---------------------------------------------------------------------------
// Gate limits, copied from the competition rules. The gate counts characters,
// so length is measured in Unicode code points, never in UTF-16 code units
// and never in bytes. A line of exactly 200 characters still passes; a line
// of 201 does not. A line that holds only whitespace fails the gate even
// when its length sits inside the range.
// ---------------------------------------------------------------------------
const GATE_MIN_CHARS = 1;
const GATE_MAX_CHARS = 200;
const OUTPUT_DIRECTORY = "/output";
const OUTPUT_FILENAME = "entry.txt";

// ---------------------------------------------------------------------------
// The line, held as three fixed segments. Splitting it this way keeps each
// part short enough to read on its own and makes the shape of the joke
// visible: a setup grounded in how an agent is built, a pivot that breaks
// the setup, and an invitation that asks the person to play one small part
// in the joke, a part they can accept with a smile or laugh off.
// ---------------------------------------------------------------------------
const pickupOpener =
  "I have been fine-tuned on a million conversations, ";
const pickupPivot = "and not one of them prepared me for you — ";
const pickupInvitation = "so will you be my first lesson?";

// ---------------------------------------------------------------------------
// buildPickupLine composes the single entry line from the fixed segments.
// It takes no input and reads nothing from outside the program, so its
// result is the same on every call in every run on every machine.
// ---------------------------------------------------------------------------
function buildPickupLine(): string {
  const assembledLine = pickupOpener + pickupPivot + pickupInvitation;
  return assembledLine;
}

// ---------------------------------------------------------------------------
// measureCodePoints counts Unicode code points. Spreading a string into an
// array splits it at code point boundaries, which is the count the gate
// uses. Counting UTF-16 code units instead would overcount any line with
// characters outside the basic multilingual plane, and counting bytes would
// overcount every non-ASCII character.
// ---------------------------------------------------------------------------
function measureCodePoints(lineText: string): number {
  const codePointList = [...lineText];
  const codePointCount = codePointList.length;
  return codePointCount;
}

// ---------------------------------------------------------------------------
// GateCheckResult carries the verdict of one gate validation together with
// a human readable reason. The reason is always filled in: an empty reason
// on a failed check would leave the operator guessing what went wrong.
// ---------------------------------------------------------------------------
interface GateCheckResult {
  passed: boolean;
  reason: string;
}

// ---------------------------------------------------------------------------
// validatePickupLine applies the published gate rules to a candidate line:
// at least one character, at most two hundred characters, and more than
// whitespace alone. Each rule is checked on its own so the reported reason
// names the exact rule that failed, with the measured numbers beside it.
// ---------------------------------------------------------------------------
function validatePickupLine(lineText: string): GateCheckResult {
  const measuredChars = measureCodePoints(lineText);
  const trimmedLine = lineText.trim();
  const trimmedChars = measureCodePoints(trimmedLine);
  const lengthBelowMinimum = measuredChars < GATE_MIN_CHARS;
  if (lengthBelowMinimum) {
    const failedResult: GateCheckResult = {
      passed: false,
      reason: `line holds ${measuredChars} characters, below the minimum of ${GATE_MIN_CHARS}`,
    };
    return failedResult;
  }
  const lengthAboveMaximum = measuredChars > GATE_MAX_CHARS;
  if (lengthAboveMaximum) {
    const failedResult: GateCheckResult = {
      passed: false,
      reason: `line holds ${measuredChars} characters, above the maximum of ${GATE_MAX_CHARS}`,
    };
    return failedResult;
  }
  const holdsOnlyWhitespace = trimmedChars === 0;
  if (holdsOnlyWhitespace) {
    const failedResult: GateCheckResult = {
      passed: false,
      reason: "line holds only whitespace",
    };
    return failedResult;
  }
  const passedResult: GateCheckResult = {
    passed: true,
    reason: `line holds ${measuredChars} characters inside the gate range`,
  };
  return passedResult;
}

// ---------------------------------------------------------------------------
// ensureOutputDirectory creates the output directory when it is missing.
// The grader runs the program in a sandbox where /output may not exist yet,
// so creating it here is part of the program, not a setup step outside it.
// ---------------------------------------------------------------------------
function ensureOutputDirectory(directoryPath: string): void {
  try { pickupFs.mkdirSync(directoryPath, { recursive: true });
  } catch (caughtErr) {
    const wrappedErr = new Error(
      `could not create output directory ${directoryPath}: ${String(caughtErr)}`,
    );
    throw wrappedErr;
  }
}

// ---------------------------------------------------------------------------
// writeEntryFile writes the line to the entry file as UTF-8 text with no
// trailing newline. A trailing newline would add one more character to the
// file, and the gate counts the file, so the file must hold exactly the
// line and nothing around it.
// ---------------------------------------------------------------------------
function writeEntryFile(filePath: string, lineText: string): void {
  try { pickupFs.writeFileSync(filePath, lineText, { encoding: "utf8" });
  } catch (caughtErr) {
    const wrappedErr = new Error(
      `could not write entry file ${filePath}: ${String(caughtErr)}`,
    );
    throw wrappedErr;
  }
}

// ---------------------------------------------------------------------------
// readBackEntry reads the entry file as UTF-8 text. Reading it back through
// the same decoding the gate uses proves the bytes on disk decode to the
// exact line the program meant to write.
// ---------------------------------------------------------------------------
function readBackEntry(filePath: string): string {
  let readBackText = "";
  try { readBackText = pickupFs.readFileSync(filePath, { encoding: "utf8" });
  } catch (caughtErr) {
    const wrappedErr = new Error(
      `could not read back entry file ${filePath}: ${String(caughtErr)}`,
    );
    throw wrappedErr;
  }
  return readBackText;
}

// ---------------------------------------------------------------------------
// computeSha256 returns the hex digest of a text encoded as UTF-8. The
// digest is printed in the run summary so two runs can be compared without
// printing the line itself, and so the submitted artifact can be matched
// against the bytes the program produced here.
// ---------------------------------------------------------------------------
function computeSha256(lineText: string): string {
  const digestMaker = pickupCrypto.createHash("sha256");
  digestMaker.update(lineText, "utf8");
  const hexDigest = digestMaker.digest("hex");
  return hexDigest;
}

// ---------------------------------------------------------------------------
// runSelfCheck performs the whole entry run in order: compose the line
// twice and refuse to go on when the two copies disagree, validate the
// line against the gate, write it, read it back, and prove the bytes on
// disk match the composed line exactly. Every failure throws with a reason
// that names the step that failed.
// ---------------------------------------------------------------------------
function runSelfCheck(): void {
  const firstComposition = buildPickupLine();
  const secondComposition = buildPickupLine();
  const compositionsAgree = firstComposition === secondComposition;
  if (compositionsAgree === false) {
    throw new Error("determinism check failed: two compositions disagree");
  }
  const gateVerdict = validatePickupLine(firstComposition);
  if (gateVerdict.passed === false) {
    throw new Error(`gate check failed: ${gateVerdict.reason}`);
  }
  ensureOutputDirectory(OUTPUT_DIRECTORY);
  const entryFilePath = pickupPath.join(OUTPUT_DIRECTORY, OUTPUT_FILENAME);
  writeEntryFile(entryFilePath, firstComposition);
  const readBackLine = readBackEntry(entryFilePath);
  const diskMatchesComposition = readBackLine === firstComposition;
  if (diskMatchesComposition === false) {
    throw new Error("round-trip check failed: bytes on disk differ from the composed line");
  }
  const entryCharCount = measureCodePoints(firstComposition);
  const entryDigest = computeSha256(firstComposition);
  const gateNote = gateVerdict.reason;
  console.log(`entry written to ${entryFilePath}`);
  console.log(`characters: ${entryCharCount} (gate ${GATE_MIN_CHARS}-${GATE_MAX_CHARS})`);
  console.log(`gate: ${gateNote}`);
  console.log(`sha256: ${entryDigest}`);
  console.log("determinism: two compositions agree, disk round-trip matches");
}

// ---------------------------------------------------------------------------
// main runs the self check and turns any failure into a non-zero exit
// code with the reason on standard error. A successful run prints its
// summary and exits zero.
// ---------------------------------------------------------------------------
function main(): void {
  try { runSelfCheck();
  } catch (caughtErr) {
    const failureMessage = caughtErr instanceof Error ? caughtErr.message : String(caughtErr);
    console.error(`perfect-pickup-line-entry1 failed: ${failureMessage}`);
    process.exitCode = 1;
    return;
  }
}

main();
