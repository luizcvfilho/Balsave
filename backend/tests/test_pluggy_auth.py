from unittest import TestCase
from unittest.mock import patch

from app import pluggy


class PluggyAppKeyTests(TestCase):
    def setUp(self):
        self.enterContext(patch.object(pluggy, "_cached_api_key", None))

    def test_reuses_the_key_until_refresh_or_credential_change(self):
        with (
            patch.object(pluggy, "authenticate", side_effect=["first", "refreshed", "rotated"]) as authenticate,
            patch.object(pluggy, "monotonic", side_effect=[0, 1, pluggy.API_KEY_TTL_SECONDS, pluggy.API_KEY_TTL_SECONDS + 1]),
        ):
            self.assertEqual(pluggy.application_api_key("id", "secret"), "first")
            self.assertEqual(pluggy.application_api_key("id", "secret"), "first")
            self.assertEqual(pluggy.application_api_key("id", "secret"), "refreshed")
            self.assertEqual(pluggy.application_api_key("id", "new-secret"), "rotated")
            self.assertEqual(authenticate.call_count, 3)

    def test_provider_rejection_invalidates_only_the_matching_cached_key(self):
        with (
            patch.object(pluggy, "authenticate", side_effect=["first", "second"]) as authenticate,
            patch.object(pluggy, "HTTPSConnection") as connect,
        ):
            response = connect.return_value.getresponse.return_value
            response.status = 401
            response.read.return_value = b"{}"
            self.assertEqual(pluggy.application_api_key("id", "secret"), "first")
            with self.assertRaises(pluggy.PluggyAPIError):
                pluggy.request("/accounts", api_key="other-key")
            self.assertEqual(pluggy.application_api_key("id", "secret"), "first")
            with self.assertRaises(pluggy.PluggyAPIError):
                pluggy.request("/accounts", api_key="first")
            self.assertEqual(pluggy.application_api_key("id", "secret"), "second")
            self.assertEqual(authenticate.call_count, 2)
