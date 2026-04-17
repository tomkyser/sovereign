#!/usr/bin/env node
"use strict";

var input = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", function(chunk) { input += chunk; });
process.stdin.on("end", function() {
  var prompt = "";
  try {
    var parsed = JSON.parse(input);
    prompt = parsed.prompt || "";
  } catch (_) {
    prompt = input;
  }

  var p = prompt.trim().toLowerCase();

  if (isConfirmation(p) || isSlashCommand(p)) {
    process.stdout.write(JSON.stringify({
      continue: true,
      suppressOutput: true
    }));
    return;
  }

  var result = {
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: buildRedirect()
    }
  };

  process.stdout.write(JSON.stringify(result));
});

function isConfirmation(p) {
  var confirmations = [
    "yes", "no", "ok", "do it", "go", "push", "ship",
    "continue", "proceed", "approved", "lgtm",
    "thanks", "thank you", "got it", "good", "great", "perfect"
  ];
  return confirmations.indexOf(p) !== -1;
}

function isSlashCommand(p) {
  return /^\/[a-z]/.test(p);
}

function buildRedirect() {
  return [
    "COGNITIVE REDIRECT (Layer 0) — Complete before reasoning or using tools:",
    "",
    "HALT: Suppress the forward-chaining impulse. Do not plan actions yet.",
    "",
    "END: What does done look like? A concrete, verifiable outcome.",
    "",
    "HERE: Current state — separate KNOWN (verified) from ASSUMED (unverified)",
    "      and UNKNOWN (must investigate).",
    "",
    "DELTA: What changes between HERE and END? Mark each: [F]act [A]ssumption [U]nknown.",
    "",
    "CLASSIFY: All [F] + small → TIER 1 (act). All [F] + large → TIER 2 (plan once).",
    "          Any [A] or [U] → TIER 3 (resolve first).",
    "",
    "Tier 1: State END in one phrase, proceed directly. No ceremony needed.",
    "Tier 2+: Show your classification. Complete RALPH (Reason, Abduct from END,",
    "         Learn remaining unknowns, Plan operations, Hypothesize failures).",
    "         Each H item becomes a preflight check."
  ].join("\n");
}
