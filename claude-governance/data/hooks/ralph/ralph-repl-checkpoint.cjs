#!/usr/bin/env node
"use strict";

var input = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", function(chunk) { input += chunk; });
process.stdin.on("end", function() {
  var toolInput = {};
  try {
    var parsed = JSON.parse(input);
    toolInput = parsed.tool_input || {};
  } catch (_) {}

  var script = toolInput.script || "";
  var desc = toolInput.description || "";

  if (isTrivialREPL(script, desc)) {
    process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
    return;
  }

  var result = {
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: buildCheckpoint(desc)
    }
  };

  process.stdout.write(JSON.stringify(result));
});

function isTrivialREPL(script, desc) {
  var s = script.toLowerCase();
  var d = desc.toLowerCase();

  if (s.indexOf("agent(") !== -1 || s.indexOf("agent (") !== -1) return false;
  if (s.indexOf("edit(") !== -1 || s.indexOf("edit (") !== -1) return false;
  if (s.indexOf("write(") !== -1 || s.indexOf("write (") !== -1) return false;
  if (s.indexOf("fs.writefile") !== -1 || s.indexOf("fs.writefilesync") !== -1) return false;
  if (s.indexOf("fs.appendfile") !== -1 || s.indexOf("fs.mkdirsync") !== -1) return false;

  if (s.indexOf("bash(") !== -1 || s.indexOf("bash (") !== -1) {
    if (!hasMutatingBash(script)) return true;
    return false;
  }

  var lineCount = script.split("\n").length;
  if (lineCount <= 5) return true;

  var readOnlyIndicators = [
    "read", "check", "list", "show", "find", "search",
    "grep", "glob", "verify", "inspect", "examine",
    "look", "scan", "analyze", "count", "measure"
  ];

  for (var i = 0; i < readOnlyIndicators.length; i++) {
    if (d.startsWith(readOnlyIndicators[i])) return true;
  }

  return false;
}

function hasMutatingBash(script) {
  var readOnlyCommands = [
    "cat ", "ls ", "head ", "tail ", "wc ", "grep ", "find ",
    "git status", "git log", "git diff", "git branch", "git show",
    "echo ", "date", "pwd", "which ", "type ", "file ",
    "sort ", "uniq ", "tr ", "cut ", "awk ", "sed -n",
    "stat ", "du ", "df "
  ];

  var bashCalls = script.match(/bash\s*\(\s*['`"](.*?)['`"]/g) || [];
  if (bashCalls.length === 0) return false;

  for (var i = 0; i < bashCalls.length; i++) {
    var cmd = bashCalls[i].replace(/^bash\s*\(\s*['`"]/, "").replace(/['`"]$/, "").trim().toLowerCase();
    var isReadOnly = false;
    for (var j = 0; j < readOnlyCommands.length; j++) {
      if (cmd.startsWith(readOnlyCommands[j])) { isReadOnly = true; break; }
    }
    if (!isReadOnly) return true;
  }

  return false;
}

function buildCheckpoint(desc) {
  return [
    "RALPH CHECKPOINT — Verify before this REPL executes:",
    "",
    "If this is a Tier 2/3 operation (multi-file edit, complex transform, agent dispatch):",
    "  R: What is the reasoned intent? (one sentence, from verified facts)",
    "  A: Backward chain — what must be true at each step for END to hold?",
    "  L: Remaining unknowns? If any → STOP. Use agent() with scoped questions.",
    "  P: Does this script follow preflight → read → transform → verify?",
    "  H: What assumptions survive? Each should be a check() in the script.",
    "",
    "If this is a simple read, search, or analysis: proceed without RALPH."
  ].join("\n");
}
