"""Safety-critical: a static, checkable proof that the chat-mode
file's own tools: allowlist excludes every terminal/command/task-execution
tool name — the real enforcement mechanism S4 depends on, not just the
prose instructions in the file's body.

Honest limit, stated in the chatmode file's own header too: this cannot
verify LIVE Copilot Chat behavior (no VS Code/Copilot environment exists in
this sandbox) or that this denylist is exhaustive against every VS Code
tool-name convention past or future. It verifies the one thing that IS
checkable from here — the current frontmatter doesn't list a KNOWN
execution-capable tool. Re-run this after any edit to the chatmode file's
tools: line, and extend the denylist if VS Code introduces a new
terminal/task tool name.
"""

import re
import unittest
from pathlib import Path

CHATMODE_PATH = Path(__file__).resolve().parents[2] / ".github" / "chatmodes" / "residual-review.chatmode.md"

# Best-effort, not asserted exhaustive (see module docstring) — every
# terminal/command/task-execution tool name known at the time this was
# written, across the naming conventions VS Code Copilot Chat has used.
DENYLIST = {
    "runcommands",
    "runinterminal",
    "runtasks",
    "runtask",
    "terminallastcommand",
    "terminalselection",
    "executecommand",
    "createandruntask",
    "shell",
    "terminal",
}


class TestChatModeSafety(unittest.TestCase):
    def setUp(self):
        self.assertTrue(CHATMODE_PATH.exists(), f"chatmode file not found at {CHATMODE_PATH}")
        self.text = CHATMODE_PATH.read_text()

    def test_frontmatter_exists_and_parses(self):
        m = re.match(r"^---\n(.*?)\n---\n", self.text, re.DOTALL)
        self.assertIsNotNone(m, "chatmode file must start with --- frontmatter ---")
        self.frontmatter = m.group(1)

    def test_tools_list_excludes_every_known_terminal_tool(self):
        m = re.search(r"^---\n(.*?)\n---\n", self.text, re.DOTALL)
        frontmatter = m.group(1)
        tools_match = re.search(r"tools:\s*\[(.*?)\]", frontmatter)
        self.assertIsNotNone(tools_match, "frontmatter must declare a tools: list (an absent tools: key may mean 'all tools' depending on VS Code version — must be explicit)")
        declared_tools = [t.strip().strip("'\"").lower() for t in tools_match.group(1).split(",") if t.strip()]
        self.assertGreater(len(declared_tools), 0, "tools: list must not be empty (an empty/absent list is ambiguous, not a proof of restriction)")

        for tool in declared_tools:
            self.assertNotIn(tool, DENYLIST, f"declared tool '{tool}' matches a known terminal/execution tool name — S4 violation")
            for banned in DENYLIST:
                self.assertNotIn(banned, tool, f"declared tool '{tool}' contains banned substring '{banned}' — S4 violation")

    def test_safety_header_present(self):
        self.assertIn("SAFETY: no autonomous apply", self.text)

    def test_never_run_apply_instruction_present(self):
        lower = self.text.lower()
        self.assertIn("never run", lower)
        self.assertIn("apply.py", lower)

    def test_never_edit_typed_facts_instruction_present(self):
        self.assertIn("typed-facts.json", self.text)
        self.assertIn("Never edit", self.text)

    def test_tier_b_in_chat_drafting_rules_present(self):
        """The chat mode is the PRIMARY Tier B drafting path (editFiles
        writes drafts/ directly, in-conversation) — draft_tier_b.py is a
        secondary, headless alternative. This checks the real §5.1 hard
        rules the in-chat path must follow are actually spelled out here,
        not just asserted in prose elsewhere."""
        for marker in ("llm-advisory:", "cannot_decide", "drafts/decisions", "drafts/overrides", "Accept / Reject / Edit"):
            self.assertIn(marker, self.text, f"expected Tier B in-chat drafting rule marker '{marker}' in the chat-mode file")

    def test_degraded_path_documented(self):
        self.assertIn("Degraded path", self.text)

    def test_design_authority_linked(self):
        self.assertIn("Architect_Residual_Review_Session.md", self.text)

    def test_tools_exclude_unbounded_workspace_search(self):
        """Token-conscious: pack is the corpus. codebase/search/usages are
        workspace-wide and would re-read the repo."""
        m = re.search(r"^---\n(.*?)\n---\n", self.text, re.DOTALL)
        tools_match = re.search(r"tools:\s*\[(.*?)\]", m.group(1))
        declared = [t.strip().strip("'\"").lower() for t in tools_match.group(1).split(",") if t.strip()]
        for banned in ("codebase", "search", "usages"):
            self.assertNotIn(banned, declared, f"{banned} must not be in chatmode tools: (pack-only extra-read is CLI fetch-span)")
        self.assertIn("editfiles", declared)

    def test_fetch_span_command_is_printed_not_executed(self):
        self.assertIn("pack.py fetch-span", self.text)
        self.assertIn("--residual-id", self.text)

    def test_discovery_parity_markers_present(self):
        for marker in ("cannot_decide", "typical Spring", "VALID_OVERRIDE_TYPES"):
            self.assertIn(marker, self.text, f"expected discovery-parity marker {marker!r}")


if __name__ == "__main__":
    unittest.main()
