# OpenSpec Workflow

## What is OpenSpec?

OpenSpec is a specification-driven development framework for managing changes to this codebase. Each significant change is captured as a "change proposal" with structured artifacts (proposal, design, specs, tasks).

## Directory Structure

```
openspec/
├── changes/                    # Active changes
│   └── <change-name>/
│       ├── .openspec.yaml      # Change metadata (schema, created date)
│       ├── proposal.md         # Problem, scope, success criteria
│       ├── design.md           # Technical design decisions
│       ├── specs/              # Detailed specifications (optional)
│       └── tasks.md            # Task list with checkboxes
├── changes/archive/            # Completed/archived changes
│   └── <date>-<change-name>/
│       └── ...
└── specs/                      # Cross-cutting specifications
    └── <capability>/
        └── spec.md
```

## Change Lifecycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Explore │───▶│ Propose  │───▶│  Design  │───▶│ Implement│
│          │    │          │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └────┬─────┘
                                                      │
                                                      ▼
                                               ┌──────────┐
                                               │ Validate │
                                               └────┬─────┘
                                                    │
                                                    ▼
                                               ┌──────────┐
                                               │ Archive  │
                                               └──────────┘
```

## Creating a New Change

1. **Explore** the problem space with `/opsx:explore`
2. **Formalize** the change with artifacts
3. **Implement** tasks with `/opsx:apply`
4. **Archive** when complete with `/opsx:archive`

## Artifact Reference

### `proposal.md`

Captures the "why" and "what":

- **Problem** — What pain point or opportunity does this address?
- **Solution** — High-level approach
- **Scope** — What's in and out of scope
- **Risks** — What could go wrong and how to mitigate
- **Success Criteria** — How do we know this change is done?

### `design.md`

Captures the "how":

- Architecture diagrams
- Component design
- Data flow
- API changes
- Dependencies
- Security considerations

### `tasks.md`

The implementation checklist:

```markdown
- [ ] Task 1: Description
- [ ] Task 2: Description
- [ ] Task 3: Description
```

Mark tasks complete as you implement them. The CLI tracks progress automatically.

### `.openspec.yaml`

Metadata file (auto-generated):

```yaml
schema: spec-driven
created: 2026-08-08
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `openspec list` | List active changes |
| `openspec status --change "name"` | Check change status |
| `openspec instructions apply --change "name"` | Get implementation instructions |

## Current Active Changes

```
$ openspec list --json
{
  "changes": [
    {
      "name": "rich-llm-chat-output",
      "completedTasks": 7,
      "totalTasks": 7,
      "status": "done"
    }
  ]
}
```

## Archived Changes

| Date | Change | Description |
|------|--------|-------------|
| 2026-08-08 | `adaptive-interview-engine` | Dynamic questioning based on answers |
| 2026-08-08 | `semantic-topic-tracking` | Coverage analysis via embeddings |
| 2026-08-08 | `real-time-ollama-streaming` | Token-by-token streaming |
| 2026-08-08 | `recruiter-dashboard-with-ai-eval` | Dashboard + comparison views |
| 2026-08-08 | `rich-llm-chat-output` | Markdown rendering + performance |

## Best Practices

1. **One change at a time** — Don't lump unrelated work into a single change
2. **Update artifacts** — If implementation reveals design issues, update `design.md`
3. **Track tasks** — Mark tasks complete as you finish them
4. **Archive when done** — Move completed changes to `archive/` for clean history
5. **Link related changes** — Reference previous changes when building on them

## Integration with Git

Changes are **not** tied to git commits or branches. You can:
- Work on multiple changes in the same branch
- Commit task-by-task or batch commits
- Use git branches if you prefer isolation

The OpenSpec system tracks logical progress; git tracks code changes.
