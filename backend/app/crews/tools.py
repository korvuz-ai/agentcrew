"""Custom CrewAI tools giving agents read/write access within a sandboxed cwd."""
from __future__ import annotations

import os
import pathlib
import subprocess
from typing import TYPE_CHECKING

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

if TYPE_CHECKING:
    pass


def _safe_path(root: str, rel: str) -> pathlib.Path:
    """Resolve path and ensure it stays within root (prevent traversal)."""
    root_path = pathlib.Path(root).resolve()
    target = (root_path / rel).resolve()
    if not str(target).startswith(str(root_path)):
        raise ValueError(f"Path '{rel}' escapes the working directory")
    return target


# ── Input schemas ─────────────────────────────────────────────────────────────

class PathInput(BaseModel):
    path: str = Field(default=".", description="Relative path within the working directory")


class WriteInput(BaseModel):
    path: str = Field(description="Relative file path to write")
    content: str = Field(description="Content to write to the file")


class CmdInput(BaseModel):
    command: str = Field(description="Shell command to run (within the working directory)")


# ── Tools ─────────────────────────────────────────────────────────────────────

class DirectoryListTool(BaseTool):
    name: str = "list_directory"
    description: str = (
        "List files and subdirectories at a path relative to the project working directory. "
        "Use '.' to list the root of the project."
    )
    root: str
    args_schema: type[BaseModel] = PathInput

    def _run(self, path: str = ".") -> str:
        try:
            target = _safe_path(self.root, path)
            if not target.exists():
                return f"Path does not exist: {path}"
            if target.is_file():
                return f"{path} is a file, not a directory"
            entries = sorted(target.iterdir(), key=lambda p: (p.is_file(), p.name))
            lines = []
            for e in entries:
                kind = "FILE" if e.is_file() else "DIR "
                size = f"  {e.stat().st_size:>8} bytes" if e.is_file() else ""
                lines.append(f"[{kind}] {e.name}{size}")
            return "\n".join(lines) if lines else "(empty directory)"
        except ValueError as e:
            return f"Error: {e}"
        except Exception as e:
            return f"Error listing directory: {e}"


class FileReadTool(BaseTool):
    name: str = "read_file"
    description: str = (
        "Read the contents of a file at a path relative to the project working directory. "
        "Returns the file's text content. Large files are truncated at 8,000 characters."
    )
    root: str
    args_schema: type[BaseModel] = PathInput

    def _run(self, path: str = ".") -> str:
        try:
            target = _safe_path(self.root, path)
            if not target.exists():
                return f"File does not exist: {path}"
            if target.is_dir():
                return f"{path} is a directory, not a file"
            content = target.read_text(errors="replace")
            if len(content) > 8000:
                content = content[:8000] + f"\n\n... [truncated — {len(content)} chars total]"
            return content
        except ValueError as e:
            return f"Error: {e}"
        except Exception as e:
            return f"Error reading file: {e}"


class FileWriteTool(BaseTool):
    name: str = "write_file"
    description: str = (
        "Write content to a file at a path relative to the project working directory. "
        "Creates parent directories as needed. Overwrites existing files."
    )
    root: str
    args_schema: type[BaseModel] = WriteInput

    def _run(self, path: str, content: str) -> str:
        try:
            target = _safe_path(self.root, path)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content)
            return f"Written {len(content)} characters to {path}"
        except ValueError as e:
            return f"Error: {e}"
        except Exception as e:
            return f"Error writing file: {e}"


class RunCommandTool(BaseTool):
    name: str = "run_command"
    description: str = (
        "Run a shell command inside the project working directory. "
        "Captures stdout and stderr. Timeout: 30 seconds. "
        "Use for running scripts, tests, builds, or any CLI tool."
    )
    root: str
    args_schema: type[BaseModel] = CmdInput

    def _run(self, command: str) -> str:
        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd=self.root,
                capture_output=True,
                text=True,
                timeout=30,
            )
            out = result.stdout.strip()
            err = result.stderr.strip()
            parts = []
            if out:
                parts.append(f"stdout:\n{out[:4000]}")
            if err:
                parts.append(f"stderr:\n{err[:2000]}")
            parts.append(f"exit code: {result.returncode}")
            return "\n\n".join(parts) if parts else "(no output)"
        except subprocess.TimeoutExpired:
            return "Command timed out after 30 seconds"
        except Exception as e:
            return f"Error running command: {e}"


# ── Factory ───────────────────────────────────────────────────────────────────

def make_cwd_tools(cwd: str) -> list:
    """Return all filesystem tools sandboxed to `cwd`."""
    if not cwd or not os.path.isdir(cwd):
        return []
    return [
        DirectoryListTool(root=cwd),
        FileReadTool(root=cwd),
        FileWriteTool(root=cwd),
        RunCommandTool(root=cwd),
    ]
