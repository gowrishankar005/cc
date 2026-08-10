"""Exit criteria: a fixture snippet with a known FAKE secret pattern
must come out redacted from redact.py — a testable claim, not a design-doc
assertion (this is exactly the gap Architect_Residual_Review_Session.md
§4.1 named and required a real test for).

Every fixture below uses an obviously fake value (never a real credential).
"""

import unittest

from redact import redact


class TestRedact(unittest.TestCase):
    def test_aws_access_key_redacted(self):
        fake = "AKIAABCDEFGHIJKLMNOP"  # fake, matches the real AWS key shape
        line = f'aws_access_key_id = "{fake}"'
        out = redact(line)
        self.assertNotIn(fake, out)
        self.assertIn("REDACTED", out)
        # architect should still see *that* something was there
        self.assertIn("AKIA", out)

    def test_bearer_token_redacted(self):
        fake_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fakefakefake"
        line = f"Authorization: Bearer {fake_token}"
        out = redact(line)
        self.assertNotIn(fake_token, out)
        self.assertIn("Bearer ***REDACTED***", out)

    def test_private_key_header_redacted(self):
        fake_key = "-----BEGIN PRIVATE KEY-----\nfakefakefakefakefake\n-----END PRIVATE KEY-----"
        out = redact(fake_key)
        self.assertNotIn("fakefakefakefakefake", out)
        self.assertIn("REDACTED", out)

    def test_connection_string_password_redacted(self):
        fake_pw = "hunter2fake"
        line = f"postgres://dbuser:{fake_pw}@db.internal:5432/app"
        out = redact(line)
        self.assertNotIn(fake_pw, out)
        self.assertIn("dbuser:", out)  # username still visible, only the password is redacted
        self.assertIn("@db.internal", out)

    def test_password_assignment_redacted(self):
        fake_pw = "s3cr3tFakeValue"
        line = f'password = "{fake_pw}"'
        out = redact(line)
        self.assertNotIn(fake_pw, out)
        self.assertIn("REDACTED", out)

    def test_no_secret_untouched(self):
        line = "public class ChargesApiResource {"
        self.assertEqual(redact(line), line)

    def test_empty_string(self):
        self.assertEqual(redact(""), "")


if __name__ == "__main__":
    unittest.main()
