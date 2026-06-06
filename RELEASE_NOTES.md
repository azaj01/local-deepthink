# Release Notes — `beta-0.0.3`

**Tag:** `beta-0.0.3`
**Date:** 2026-06-05
**Tagline:** "The hard-fought quality release — 11 bugs fixed, 195/195 tests passing"

> *"A week of debugging is better than a month of 'works on my machine'."*

This release is the result of a complete, exhaustive test suite of the entire
codebase (11 phases × 195 checks). Every previously-known failure path was
either fixed or pinned with a regression test. **No known malfunctions remain.**

---

## 🐛 Bug Fixes

### Critical (broke core flows)

1. **`DistillationMockLLM` had stale prompt patterns** (app.py)
   The chains in `distillation_chains.py` had been rewritten ("Socratic Task
   Master…", "Seed Creator (The Dialectic Synthesizer)", "deepening our
   inquiry in a new Epoch") but the mock LLM still matched the OLD text.
   In debug mode, **every distillation epoch silently failed** to evolve
   topics or generate new questions. Fixed by re-aligning the patterns.

2. **`CoderMockLLM` hardcoded 4 sub-problems** (app.py)
   The mock decomposer returned the same static 4-item list regardless of
   the requested count, so `reframe_and_decompose` always failed for
   non-4-agent QNNs. Fixed by reading the requested count from the prompt.

3. **Missing `grandalf` dependency** (requirements.txt)
   `graph.get_graph().draw_ascii()` requires `grandalf`; without it, the
   entire `/build_and_run_graph` endpoint crashed with a confusing error.
   Added `grandalf` to `requirements.txt`.

4. **`synthesis_node` returned "no inputs" in brainstorm mode** (app.py)
   The empty-`agent_outputs` check fired *before* the brainstorm branch,
   but brainstorm synthesis reads from `memory`, not `agent_outputs`.
   Reordered the checks so brainstorm mode can synthesize.

### Medium (data/UX quality)

5. **Duplicate `get_opinion_synthesizer_chain`** (chains/__init__.py)
   Two modules defined functions with the same name; the import order
   silently shadowed the synthesis version with the brainstorm version.
   Renamed the brainstorm one to `get_brainstorming_opinion_synthesizer_chain`.

6. **`app.GraphState` missing brainstorm fields** (app.py)
   `app.GraphState` was missing `brainstorm_document_context`,
   `brainstorm_prior_conversation`, and `brainstorm_problem_summary` that
   the code accesses. Runtime worked because of `state.get(...)`, but
   the type was lying. Added the fields.

7. **`clean_and_parse_json` couldn't repair Windows backslash paths** (utils.py)
   Strings like `{"path": "C:\\Users\\foo"}` (single backslashes, as an
   LLM would write) were returned as `None`. Fixed the regex to not
   double-escape already-escaped backslash pairs (needed non-capturing
   group `(?:\\)` to make the lookbehind work in Python's `re` module).

### Low (hygiene)

8. **Stray `print()` statements** in `TokenUsageTracker`,
   `RAPTOR._cluster_nodes`, and both chat endpoints — all converted to
   `log_stream.put(...)` so logs flow through the SSE broadcast.

9. **Typo "Sesion"** in `/chat` and `/diagnostic_chat` print statements —
   fixed to "Session" and routed through `log_stream`.

10. **`.gitignore`** missed `venv/`, `tests/`, `distillation_output/`,
    `test_results/`. Updated.

11. **No `__version__` or `pyproject.toml`** — release tracking was
    impossible. Added `__version__ = "0.0.3-beta"`, `__release_name__`,
    `__release_tag__`, and a `pyproject.toml` with project metadata
    + all dependencies.

---

## ✨ Improvements

- `deepthink/__init__.py` now exposes `__version__`, `__release_name__`,
  `__release_tag__` for runtime introspection.
- `pyproject.toml` enables `pip install -e .` workflows and standard
  packaging. It pins `grandalf` (alongside all other deps).
- `tests/` directory contains 11 numbered test phases covering: imports,
  utilities, chain factories, state types, FastAPI routes, distillation,
  mock LLM patterns, graph nodes, end-to-end HTTP, static analysis,
  and **regression tests for every bug fixed in this release**.

---

## 🧪 Test Suite

The release ships with a 195-check, 11-phase test suite. To run:

```bash
# Phase 1-8, 10, 11 (pure unit tests, no network)
venv/Scripts/python.exe tests/phase1_imports.py
venv/Scripts/python.exe tests/phase2_utils.py
...
venv/Scripts/python.exe tests/phase11_regression.py

# Phase 9 (requires a real FastAPI test client; ~60s)
venv/Scripts/python.exe tests/phase9_e2e.py
```

Final tally:

| Phase | Subject | Result |
|------:|---------|--------|
| 1 | Module imports & structure | 7/7 ✅ |
| 2 | utils.py (JSON repair, sandbox) | 15/15 ✅ |
| 3 | All 30 chain factories construct | 34/34 ✅ |
| 4 | state.py GraphState consistency | 5/5 ✅ |
| 5 | FastAPI endpoints surface | 18/18 ✅ |
| 6 | DistillationGraph end-to-end | 20/20 ✅ |
| 7 | Mock LLM prompt patterns | 21/21 ✅ |
| 8 | LangGraph nodes | 18/18 ✅ |
| 9 | Live HTTP API via TestClient | 20/20 ✅ |
| 10 | Static analysis, packaging | 23/23 ✅ |
| 11 | Regression tests (this release) | 14/14 ✅ |
| | **Total** | **195/195 ✅** |

---

## 📦 Install

```bash
pip install -r requirements.txt   # adds the new grandalf dep
# or, with the new pyproject.toml:
pip install -e .
python app.py
# → http://localhost:8000
```

---

## 🔬 For Contributors

- Read `tests/phase11_regression.py` before merging — every bug fixed in
  this release has a regression test there. Add new tests next to the
  relevant one.
- All new code should be importable from `deepthink` (the library) and
  use `log_stream.put(...)` (not `print`) for runtime logging.
- Avoid redefining factories with the same name across multiple
  `deepthink/chains/*.py` modules. If you must, give them a module-
  specific prefix (e.g. `get_brainstorming_*`).

---

## 👥 Acknowledgments

This release exists because we did the boring work: enumerate every
feature, write a test for it, fix what broke, and pin it. The codebase
is now measurably more robust than it was a week ago.

— *the open-deepthink maintainers*
