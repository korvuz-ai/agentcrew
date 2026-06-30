from __future__ import annotations

import os

from crewai import Agent as CrewAgent, LLM

# Maps our provider names to the env var LiteLLM reads for API keys
PROVIDER_KEY_ENV: dict[str, str] = {
    "claude": "ANTHROPIC_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "gpt":    "OPENAI_API_KEY",
}


def pick_provider(
    providers: list[str],
    vault_keys: dict[str, str] | None = None,
    company_id: str = "",
    skip_providers: set[str] | None = None,
    preferred: str | None = None,
) -> str:
    """Return first provider that has a key and is not rate-limited.

    Priority: preferred > vault key > env var. Rate-limited providers (Redis) are skipped.
    Falls back to providers[0] if nothing better found.
    """
    from app.crews.fallback import is_rate_limited  # avoid circular at module level

    vault = vault_keys or {}
    skip = skip_providers or set()

    def _has_key(p: str) -> bool:
        if p in vault:
            return True
        env_var = PROVIDER_KEY_ENV.get(p, "")
        return bool(env_var and os.environ.get(env_var))

    # Try preferred provider first (if agent supports it and has a key)
    if preferred and preferred not in skip and preferred in providers and _has_key(preferred):
        return preferred

    # First pass: key + not rate-limited
    for p in providers:
        if p in skip:
            continue
        if _has_key(p) and not (company_id and is_rate_limited(company_id, p)):
            return p

    # Second pass: has key, ignore rate-limit (don't hard-block if all are limited)
    for p in providers:
        if p in skip:
            continue
        if _has_key(p):
            return p

    return providers[0] if providers else "claude"


def build_crew_agent(
    db_agent,
    model_id: str,
    skills_content: str = "",
    allow_delegation: bool = False,
    api_key: str | None = None,
    cwd_tools: list | None = None,
) -> CrewAgent:
    """Convert a DB Agent row into a crewai.Agent ready to join a Crew."""
    backstory = (db_agent.backstory or "").strip()
    if skills_content:
        backstory = f"{backstory}\n\nCapabilities & Skills:\n{skills_content}".strip()
    if not backstory:
        backstory = f"You are {db_agent.name}, a skilled {db_agent.role or 'professional'}."

    llm_kwargs: dict = {"model": model_id}
    if api_key:
        llm_kwargs["api_key"] = api_key

    agent_kwargs: dict = dict(
        role=db_agent.role or db_agent.name,
        goal=f"Complete your assigned tasks with expertise as {db_agent.role or db_agent.name}.",
        backstory=backstory,
        llm=LLM(**llm_kwargs),
        verbose=True,
        allow_delegation=allow_delegation,
    )
    if cwd_tools:
        agent_kwargs["tools"] = cwd_tools

    return CrewAgent(**agent_kwargs)
