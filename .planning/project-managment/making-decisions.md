1. **Align with the vision.** Does this decision serve the project intent described in
   `.planning/VISION.md`? If you can't articulate how, stop and re-read it.
2. **Cross-reference the roadmap.** Does this decision align with the phased plan?
   Does it create dependencies that conflict with later phases?
3. **Cross-reference STATE and CONTEXT.** Is this consistent with current project state?
   Does it account for what's already built and what's planned?
4. **Check for existing solutions.** Before writing new code, check if the capability
   already exists in a tool we're forking or a reference project in `.planning/REFERENCES.md`.
5. **Take terms literally.** "Fork" means git fork. "Bundle" means include in the
   package. "Extract" means pull from the binary. Do not reinterpret standard SWE
   vocabulary into something easier to implement.
6. **Never choose the path of least resistance.** The simplest option is only acceptable
   when it compromises nothing — quality, durability, cross-platform support, future
   extensibility. If it's easy, ask why. If the answer is "because it cuts corners," redo.
7. **Adversarial self-deliberation.** Before committing to a decision, try to defeat the
   strongest version of it. What breaks this on Linux? On a newer CC version? When the
   minifier changes? If you can't defeat it, it's strong enough. If you can, strengthen it.
