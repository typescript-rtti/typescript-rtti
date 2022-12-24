<!--
    Thank you for your interest in opening a pull request to `typescript-rtti`!
    Please review the guidelines below, and make any necessary changes to your PR.
-->

# Guidelines
Once you have ensured that the guidelines are being adhered to, you may delete this copy.

A good PR is
- **Minimal**
  The PR should change as little as possible to accomplish the stated goal.
  - Do not change formatting unless your PR is specifically to change formatting.
  - Do not refactor more than necessary to accomplish the goal
  - Do not include whitespace-only changes to the extent possible.
- **Conventional**
  The PR should follow the formatting and idioms of the codebase. If you introduce code formatted differently from the rest of the codebase, do not be surprised if you are asked to correct for this
- **Reasoned**
  The PR description should carefully explain the rationale behind your changes, and be supported by use cases where appropriate. Please consider the open issues which your PR resolves, and make sure to list them in the Development section of the sidebar so that we can keep the issue list tidy.
- **Tested**
  New functionality should be tested, and all tests should pass. It is your responsibility to ensure the existing
  test suite passes, and reviewers should not have to remind you to fix issues that cause test failures.
  - Note that PRs run both the unit test suite and the "corpus" test suite, which is effectively an integration test suite. This test suite can take quite a lot of time to run. To avoid long feedback cycles due to CI, familiarize yourself with how to run the corpus test suite locally. You can use the `only` option (see `src/test/corpus/main.ts`)
  to test a specific codebase, and you can locally modify the `TYPESCRIPTS` constant to run only the problematic
  Typescript versions. Run the corpus test suite with `npm run test:corpus`.