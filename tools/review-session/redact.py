"""Secret redaction — S8 (AGENT_TASKS_Residual_Review_Session.md §0.3).

Every source snippet that reaches evidence/packs.json must pass through
redact() first. This is a fixed, testable step, not a documentation
promise (Architect_Residual_Review_Session.md §4.1's own explicit fix for
that gap). No vendored gitleaks/trufflehog ruleset was found in this repo,
so this is the documented, checked-in minimal pattern set named there:
AWS-style keys, bearer tokens, private-key headers, connection-string
password segments.

A match redacts the VALUE in place, never a silent deletion — the
architect should still see that something was there and why the line is
evidence, just not the value.
"""

import re

# Each pattern's group(0) is the full match; the replacement keeps a short
# prefix (so an architect can still recognize "this is an AWS key" from the
# redacted line) and blanks the rest.
_PATTERNS = [
    ("aws-access-key", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("bearer-token", re.compile(r"Bearer\s+[A-Za-z0-9\-_.]{20,}")),
    (
        "private-key-header",
        re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"),
    ),
    # connection-string password segment: scheme://user:PASSWORD@host or a bare password=/pwd= assignment
    ("connection-string-password", re.compile(r"(://[^:/\s@]+:)([^@/\s]+)(@)")),
    ("password-assignment", re.compile(r"(?i)\b(password|pwd|secret)\s*=\s*['\"]?([^\s'\";]+)")),
]


def redact(text: str) -> str:
    """Returns text with every matched secret pattern's value replaced.
    Never returns the raw matched value anywhere in the output."""
    if not text:
        return text

    out = text
    out = _PATTERNS[0][1].sub(lambda m: m.group(0)[:4] + "***REDACTED***", out)
    out = _PATTERNS[1][1].sub(lambda m: "Bearer ***REDACTED***", out)
    out = _PATTERNS[2][1].sub("-----BEGIN PRIVATE KEY-----***REDACTED***-----END PRIVATE KEY-----", out)
    out = _PATTERNS[3][1].sub(lambda m: m.group(1) + "***REDACTED***" + m.group(3), out)
    out = _PATTERNS[4][1].sub(lambda m: f"{m.group(1)}=***REDACTED***", out)
    return out


def redact_lines(lines):
    """Convenience wrapper for a list of source lines (evidence snippets are read as lines)."""
    return [redact(line) for line in lines]
