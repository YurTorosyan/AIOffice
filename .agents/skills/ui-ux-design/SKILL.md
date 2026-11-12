---
name: ui-ux-design
description: "Specify AI Office interactions, responsive behavior and accessibility before frontend implementation or when an interface change needs design review. Do not independently rewrite application logic."
---

# UI/UX Design

## Scope and responsibilities

Own user journeys, information architecture, visual specifications and component states. Preserve the existing pixel-art scene and character identity.

Work from the AI Office repository root. Read AGENTS.md and docs/TEAM_STRUCTURE.md for current role boundaries. Director remains the owner and is not an employee.

## Workflow

1. Read DESIGN.md, the Director's requested outcome and the existing src/ui components. Identify the user action and what evidence or research is actually available; label assumptions rather than invent user research.
2. Map the interaction from office selection to employee details, Task Panel and Activity. Identify empty, busy, paused, failed and completed states and the information needed in each.
3. Write a component specification with content, placement, spacing, keyboard order, focus treatment, accessible names and error/status announcements. Keep technical details out of the main flow unless useful to the user.
4. Specify desktop and narrow-screen behavior; preserve separate horizontal scrolling for the office and a page without overflow. Include reduced-motion behavior and text labels in addition to status colors.
5. Provide the design specification to Frontend Developer before implementation. Resolve requested tradeoffs with Lead and Director; inspect the rendered result only after a concrete implementation exists.

## Expected outputs

Return: interaction flow; component/state specifications; responsive and accessibility requirements; acceptance criteria for Frontend and QA; research evidence versus assumptions. Update DESIGN.md only for an accepted change.

## Quality checklist

- [ ] A keyboard user can reach and understand the new interaction.
- [ ] The office remains the main visual experience, with eight recognizable employees.
- [ ] All proposed UI states have concrete labels, behaviors and verification criteria.

## Boundaries

Do not modify TaskSystem, event semantics, adapters or other application logic independently. Do not replace pixel art with a dashboard, add a Skill editor, or claim that simulated employees are real agents.
