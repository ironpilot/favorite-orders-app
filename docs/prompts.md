## Creating Spec

- Using this spec, tell me what you'd end up building in detail. Tell me the features you'd add in detail, the flows you'd create and the technical decisions you'd make.
- Using spec.md, please generate what you think [feature/page] will look like.
- Based on the spec, what might we have missed?
- Please give me choosable options for each of these one by one, so I can decide.

## Extract Features
```
Read spec.md and extract the core product features. Create a new document called features.md.

For each feature include:
- Feature name
- Short description (1–2 sentences)
- User flow (how a user interacts with this feature step-by-step)
- UI overview (what the user sees or interacts with)
  Keep everything high level and product-focused.
  
Do NOT include:
- database schemas
- file names
- file paths
- class names
- API endpoints
- implementation details

Only include features that are clearly described in spec.md. Do not invent new features.
```

- Could you re-arrange these in a sensible implementation order?
- Keep all existing agreed rules unchanged (email login, newest-first logs, category filter + keyword search, stop-time log form with preselected last category, and implementation order).

## Create Scaffold

- Generate a prompt to create an overall app layout for our project, including logo (text based), menu items, create log entry button, and main slot content area. This should be design based only and not functional yet. We're scaffolding our boilerplate.

## Extract Features

```
Extract the feature [feature] from features.md into its own markdown document, feature-[FEATURE_NAME].md.
Instructions:
- Preserve the original intent of the feature
- Pull in any relevant requirements, constraints, assumptions, dependencies, edge cases, and related notes from elsewhere in features.md or spec.md
- Exclude unrelated features or implementation details that do not directly support this feature
- Rewrite the extracted feature into a clean, structured spec that is easier to plan in detail
  Output format:
# [Feature Name]
## Summary
A short plain-English summary of the feature and its purpose.
## Goals
Clear outcomes this feature should achieve.
## Requirements
Functional requirements only for this feature.
Do not start designing the solution yet
Do not propose any low level technical decisions
```

Feature Implementations

```aiignore
How might you build this based on this feature document only? Give me the technical decisions you'd make in a simple list.
```

Set some guard rails

```aiignore
What helpful additions might you sprinkle in if building this that we don’t want?
```

```aiignore
Add these to the constraints section and/or update applicable sections of the feature plan:
- *[Feature you don't want]
- *[Package you don't want to include]
```

### Add Implementation Directions

```aiignore
Add a new section, “Implementation Steps” and break up this feature into smaller, ordered implementation steps. These steps should be large enough to add a significant and usable feature, but small enough that we can comfortably review it.
```

### Implementation Status

```aiignore
Add a final section to capture which implementation status tracking the progress of each implementation steps.
```

## Tests

```aiignore
Add a simple bulleted list of tests under a Tests heading for each implementation step.
```

```aiignore
Generate a prompt to write tests for Implementation Step [step number], using [testing framework].
```

```aiignore
We want to run linting (php and js), static analysis and tests every time that we (or you) change something. Add to Agent.md.
```
