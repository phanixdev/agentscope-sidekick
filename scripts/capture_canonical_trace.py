from __future__ import annotations

from dataclasses import asdict

from apps.api.main import execute_demo_run


if __name__ == "__main__":
    print({"canonical_trace": asdict(execute_demo_run("tool_failure"))})