# UI Generation Prompts — AgentCrew Platform

เขียนเป็นภาษาอังกฤษเพื่อให้ได้ผลลัพธ์ที่แม่นยำที่สุดเมื่อป้อนเข้า AI UI tool
(Claude / v0.dev / Lovable / Figma Make) — ก่อนใช้ ใส่ context เพิ่ม "Next.js 14
App Router, TailwindCSS, shadcn/ui" เสมอ

---

## 1. Onboarding — Create/Select Company
```
Design a clean onboarding screen for a B2B SaaS. After login, the user sees
two large clickable cards side by side:
- "Create a new company" — icon of a building/plus, short subtext
  "Start a fresh AI workforce"
- "Select an existing company" — shows a list/grid of company cards below
  (logo placeholder, name, agent count badge) if the user already belongs
  to one or more companies
Minimal, centered layout, generous whitespace, single primary CTA per card.
Style: modern SaaS dashboard, not playful/cartoonish.
```

## 2. Org Chart
```
Design an organization chart page showing AI agents as a company hierarchy.
Root node = "Orchestrator" agent at top, connected downward to "Worker"
agent nodes via clean curved or right-angle connector lines (like a flowchart/
org chart tool). Each node is a compact card showing: agent avatar (abstract
geometric icon, color-coded by level 1/2/3), name, role/title, small badge
showing which LLM provider icon is active (Claude/Gemini/GPT). Support
zoom/pan on canvas. Empty state: friendly illustration + "Add your first
agent" CTA. Style: clean technical diagram, light background, subtle grid.
```

## 3. Library (Skills)
```
Design a library page listing reusable "skills" that can be attached to
agents — think of it like a card catalog. Grid of skill cards, each showing:
skill name, 1-line description, tag/category chip, and how many agents
currently use it. Top bar has search + "Create new skill" button. Clicking
a card opens a side panel/modal with a markdown editor (skill instructions,
similar to writing a SKILL.md file) and a multi-select to assign which
agents use this skill. Style: clean reference-library feel, card grid,
subtle hover lift.
```

## 4. Agent Card (list + detail)
```
Design an agent management page styled like a trading-card game collection.
Grid of agent cards: each card has a portrait/avatar area, name, role,
a "Level" badge (1/2/3, gold/silver/bronze accent), small icon row showing
which LLM providers (Claude/Gemini/GPT) this agent is allowed to use, and
a list of attached skill tags at the bottom. "+ New Agent" card with dashed
border at the end of the grid.

Clicking a card opens a detail/edit view (modal or full page) with:
- Editable name, role, backstory/personality text area (CrewAI-style)
- Level selector (1/2/3) shown as a slider or stepped radio with visual tier
- Provider toggle (checkbox per provider: Claude, Gemini, GPT) — only
  checked providers are selectable later for this agent
- Skill picker (multi-select from Library)
- "System prompt override" advanced collapsible section
Style: playful card-game aesthetic for the grid, clean form aesthetic for
the edit panel — keep the two visually distinct so editing still feels
professional.
```

## 5. Pipeline Builder
```
Design a pipeline builder page (MVP version: form-based list, not full
drag-drop canvas). Top: pipeline name + description input, and a toggle
for "Pipeline type": Orchestrator-Worker vs Sequential Pipeline.

If Orchestrator-Worker: show one "Orchestrator agent" selector dropdown at
top, then a list of "Worker agent" rows below with add/remove buttons, each
row has an agent selector + a condition input (when should this worker run).

If Sequential Pipeline: show a vertical ordered list of steps, each step =
agent selector + drag handle to reorder + arrow connector between steps
showing data flows downward.

Bottom: "Save" and "Run now" buttons. Style: form-heavy but visually
organized with clear step numbering and connecting lines between rows.
```

## 6. Chat (LINE-style with agent trace)
```
Design a chat interface styled like a messaging app (similar to LINE/
Slack thread). Left sidebar: list of past sessions (collapsed on mobile).
Main panel: chat bubbles — user messages right-aligned, agent messages
left-aligned with the speaking agent's avatar + name label above each
bubble (so when multiple agents talk in sequence, it reads like a group
chat). Each agent bubble has a small inline meta row below the text:
token count, cost ($), and elapsed time (ms), in a muted small font.
A collapsible "thinking" sub-bubble (lighter background, italic) shows
intermediate reasoning before the agent's final message in that turn.
Bottom: a chat input bar with a paperclip icon for file upload (shows
uploaded file as a chip above the input before sending) and send button.
Top bar: pipeline/session name + a running total cost badge that updates
live. Style: familiar messaging-app clarity, not playful.
```

## 7. History
```
Design a history page listing past chat sessions as a table/list: session
name (auto-generated from first message), company, pipeline used, total
cost, total time, date, and a status chip (completed/failed/running).
Search bar + filter by pipeline/date range. Clicking a row opens the full
chat in read-only mode (reuse Chat component). Style: clean data table,
sortable columns.
```

## 8. Settings (API Keys)
```
Design a settings page with a section "API Keys" listing 3 provider rows
(Claude, Gemini, GPT) — each row has: provider logo, masked key input
(e.g. "sk-ant-••••1234"), a status indicator (Connected/Not set/Invalid),
"Test connection" button, and "Update key" action. Include a note that
keys are encrypted at rest. Below: a "Budget cap" section with a numeric
input for monthly spend limit and an alert threshold percentage. Style:
standard SaaS settings page, security-conscious tone (lock icons, muted
colors), no playful elements here.
```

## 9. (Optional, later phase) Office Visual Mode
```
Design an alternate visual mode for the Chat/Org Chart pages: a 2D
anime-style office floor plan where each agent is a small character sprite
seated at a desk matching their role. When an agent is "speaking" in the
current pipeline run, show a speech-bubble pop-up above their character
with a condensed version of their message. Idle agents sit quietly at
their desks. Style: warm, soft-colored 2D anime office illustration —
this view is a toggle alternative to the standard chat bubble view, not
a replacement.
```
