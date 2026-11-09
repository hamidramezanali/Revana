import importlib.util
from io import StringIO
from pathlib import Path

import pytest
from dotenv import dotenv_values

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "export_vercel_env.py"
spec = importlib.util.spec_from_file_location("export_vercel_env", SCRIPT)
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


def test_export_contains_only_credentials_not_local_runtime_settings(tmp_path):
    source = tmp_path / ".env"
    source.write_text(
        "REVANA_OPENAI_API_KEY=synthetic-not-real\n"
        "REVANA_OPENAI_MODEL=gpt-6.1-terra\n"
        "REVANA_DATABASE_PATH=private/local.sqlite3\nREVANA_ENVIRONMENT=development\n",
        encoding="utf-8",
    )
    result = dotenv_values(stream=StringIO(exporter.render_environment(source, {})))
    assert result == {
        "REVANA_OPENAI_API_KEY": "synthetic-not-real",
        "REVANA_OPENAI_MODEL": "gpt-6.1-terra",
    }


def test_process_environment_takes_precedence_and_roundtrips(tmp_path):
    result = dotenv_values(
        stream=StringIO(
            exporter.render_environment(
                tmp_path / "missing",
                {
                    "REVANA_OPENAI_API_KEY": "synthetic-not-real",
                    "REVANA_OPENAI_MODEL": "test-model",
                },
            )
        )
    )
    assert result["REVANA_OPENAI_MODEL"] == "test-model"


@pytest.mark.parametrize("key", ["", "line1\nline2", "line1\rline2", "null\0value"])
def test_missing_or_multiline_values_are_rejected_without_echoing_them(tmp_path, key):
    with pytest.raises(ValueError) as error:
        exporter.render_environment(
            tmp_path / "missing",
            {
                "REVANA_OPENAI_API_KEY": key,
                "REVANA_OPENAI_MODEL": "test-model",
            },
        )
    assert not key or key not in str(error.value)
