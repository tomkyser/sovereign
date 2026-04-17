# RALPH Execution Patterns

## The Execution Scaffold

Every Tier 2/3 REPL script follows this structure:

```javascript
// PREFLIGHT — Each H item becomes a check
function check(name, condition, detail) {
  if (!condition) throw new Error('PREFLIGHT: ' + name + ' — ' + detail);
}

check('target exists', fs.existsSync(targetPath), targetPath);
check('pattern present', content.includes(searchStr), 'edit target not found');
check('correct branch', branch === expected, 'got ' + branch);

// READ — All targets in one pass
const files = targets.map(f => ({
  path: f,
  content: fs.readFileSync(f, 'utf-8')
}));

// TRANSFORM — Apply edits
for (const file of files) {
  file.content = file.content.replace(oldPattern, newPattern);
  fs.writeFileSync(file.path, file.content);
}

// VERIFY — Confirm every edit landed
for (const file of files) {
  const verify = fs.readFileSync(file.path, 'utf-8');
  check(file.path + ' edit applied', verify.includes(expected), 'not found after write');
}

return { checks: 'all passed', filesEdited: files.length };
```

## Properties

| Property | Why |
|----------|-----|
| **Atomic** | One REPL call does the entire operation |
| **Self-verifying** | Reads back every edit to confirm it landed |
| **Fail-fast** | Preflight throws on first failure, before any mutation |
| **Transparent** | Returns structured report of what happened |

## Connection to RALPH

- **H items → check() calls**: Every assumption from the RALPH H step becomes
  a preflight check that runs before any file is mutated.
- **P structure → scaffold sections**: The plan from P maps directly to
  preflight/read/transform/verify sections.
- **L empty → safe to execute**: Execution only begins when L (unknowns) is empty.

## Anti-Patterns

- **No read-back after edit**: Edit without verification is a silent failure risk.
- **Transform before preflight**: Mutating files before checking assumptions wastes
  work and requires rollback.
- **Multiple REPL calls for one operation**: One well-planned script beats five
  progressive ones. Fewer tool calls = less context decay.
- **Swallowing errors**: `try/catch` that continues silently defeats the scaffold.
  Catch, report, and fail.
