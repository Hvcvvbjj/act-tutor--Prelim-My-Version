# Visual contract — first vertical slice

## Accepted concepts

- `onboarding-desktop-concept.png`: desktop onboarding, goal-score state.
- `onboarding-mobile-concept.png`: mobile onboarding, current-score state.
- `dashboard-desktop-concept.png`: provisional study-plan dashboard.

These raster files are design references only. All interface text, controls, navigation, progress, tasks, scores, and state remain code-native.

## UI-library resources selected

The implementation is reviewed against these 30 local resource-library entries:

`DSR-002`, `DSR-013`, `AD-009`, `LC-005`, `LC-010`, `NIA-002`, `TY-005`, `TY-008`, `CMI-004`, `CC-001`, `CC-002`, `PAS-001`, `PAS-004`, `PAS-006`, `FCF-001`, `FCF-002`, `FCF-004`, `ELP-001`, `ELP-002`, `ELP-005`, `ELP-014`, `AIA-001`, `AIA-005`, `OES-001`, `TSP-002`, `ARQ-001`, `ARQ-003`, `ARQ-010`, `IPQ-005`, `IPQ-018`.

## Design contract

### Visual thesis

A focused academic coach: editorial study-guide precision with restrained game progression. The surface is true white with deep navy ink, a cobalt progress/action color, cool gray rules, and a small coral reward accent. It should feel mature and optimistic, not childish or like a generic pastel SaaS template.

### Content hierarchy

1. The one placement question or today's highest-value task.
2. The learner's progress through onboarding or the plan.
3. Evidence and context: scores, remaining days, confidence, and assignment reason.

### Interaction thesis

- Score controls feel tactile and update immediately.
- Advancing a placement step moves the question and extends progress without losing state.
- Generating the plan reveals the study path; completing tasks advances nodes rather than merely changing a metric card.
- Reduced-motion users receive the same clear state changes without sliding animation.

### Anti-generic rule

No marketing hero, bento grid, decorative AI chat box, copied Duolingo visual language, fake metrics, or rounded card around every piece of content. Scout may appear only when it teaches, reflects model state, or helps repair an error—not as decorative chrome. The working surface is the first screen.

## Extracted tokens

- Background: `#ffffff`.
- Ink: approximately `#071638`.
- Primary cobalt: approximately `#075eea`.
- Muted text: approximately `#63708a`.
- Rules/borders: approximately `#d7dce5`.
- Subtle information surface: approximately `#eef5ff`.
- Reward accent: approximately `#ff5a3d`.
- Radius: 10–14 px for controls and task containers; fully round only for progress nodes/avatar.
- Elevation: almost flat; borders and spacing carry hierarchy.
- Typography: one disciplined geometric/humanist sans family across desktop and mobile, with heavy display weights and deliberate control text.

## Component inventory

- Quiet brand header.
- Three-step progress bar and desktop step rail.
- Goal score stepper.
- Exclusive prior-score choice.
- Labeled score number fields and optional Science switch.
- Test-date input with quick upcoming-date choices.
- Primary/secondary navigation buttons.
- Plan header and score strip.
- Vertical study-path rail.
- Task row variants: current, upcoming, completed, checkpoint.
- Weekly completion dots.
- Provisional-evidence information alert.

## Responsive rules

- Desktop onboarding uses a wide primary form workspace and a narrow explanatory step rail.
- Mobile removes the side rail, keeps the progress bar, stacks fields, and preserves large touch targets.
- Dashboard collapses its right evidence panel below the Today path on narrow screens.
- Primary actions must not require horizontal scrolling or precision tapping.

## Recorded concept reconciliation

The generated mobile concept used a serif question heading while the desktop concepts used a strong sans. The implementation intentionally uses one consistent sans family across viewports to preserve product continuity and avoid a one-off responsive font change.

## Implementation fidelity ledger

Compared at the concept's native desktop viewport (`1487 × 1058`) and the mobile concept viewport (`853 × 1844`):

1. **Hierarchy — matched.** The current question or plan headline remains the dominant element, with progress/evidence one level below it.
2. **Onboarding composition — matched.** Desktop preserves the two-column workspace and step rail; mobile removes the rail without changing task order.
3. **Visual system — matched.** White canvas, deep navy type, cobalt actions/path, cool gray rules, flat surfaces, and restrained radii all carry through to code.
4. **Dashboard structure — matched.** The Today path, vertical progression line, three task rows, and right-side provisional score panel use the accepted concept's geometry.
5. **Responsive behavior — matched.** Mobile checks at `390 × 844` and `853 × 1844` showed no horizontal overflow, retained large targets, and kept the primary action visible.
6. **Interaction — expanded faithfully.** The coded version adds full-score, Composite-only, and never-tested branches, inline validation, plan/progress tabs, lesson completion, and the diagnostic runner without changing the visual thesis.
7. **Intentional deviation — honest time allocation.** The concept's task times totaled 23 minutes; implementation uses 8 + 12 + 10 minutes so the visible work matches the promised 30-minute session.
8. **Intentional deviation — dynamic scheduling.** “Tomorrow” and “Friday checkpoint” became “Next session” and a computed checkpoint cadence so the interface does not make a false calendar promise.

Temporary implementation captures used for this review were kept outside the repository so dev-browser chrome is not shipped as a product asset.

## Adaptive-model extension

The Precision Check extends the accepted dashboard into a live psychometrics workspace. It was grounded in the existing Scout field-notebook system and reviewed against the additional local resources `DSR-006`, `LC-006`, `PAS-002`, `PAS-009`, `ARQ-006`, `AIA-002`, `AIA-004`, `AIA-007`, `AIA-011`, `AIA-017`, `ELP-004`, `ELP-011`, `ELP-017`, `DSM-005`, `RST-008`, `DVA-018`, and `IPQ-019`.

### Fidelity and interaction ledger

1. **Hierarchy — matched.** The ACT-shaped item is the dominant decision surface; ability/uncertainty and “Why this item” evidence are subordinate, not a stat-card dashboard.
2. **Visual language — matched.** Deep navy rules, cobalt/teal evidence states, editorial labels, squared surfaces, and restrained shadows reuse Scout’s established notebook grammar.
3. **Adaptive interaction — proved.** A live answer changed theta from `+0.13` to `+0.24`, reduced standard error from `0.36` to `0.35`, triggered the explicit precision stop, and appeared in BKT.
4. **Trust state — expanded.** Representative evidence is visibly labeled, answer keys remain server-only, and the UI separates model readiness from official ACT scores.
5. **Responsive behavior — proved.** The Learning Twin at `390 × 844` rendered inside a 375 px document width with no horizontal overflow; navigation and all semantic controls remained available.

## Diagnostic-runner extension ledger

The runner extends `dashboard-desktop-concept.png` rather than introducing a new visual direction. It was compared at `1487 × 1058` desktop and `390 × 844` mobile:

1. **Palette — matched.** True white, deep navy, cobalt progress/action color, cool rules, and the existing information surface are unchanged.
2. **Container model — matched.** The runner uses an open workspace with a narrow evidence/progress rail, not a new card shell or marketing wrapper.
3. **Typography — matched.** Brand, utility labels, question display type, body copy, and control text keep the existing Geist hierarchy and weights.
4. **Progress motif — matched.** Section dots and the cobalt question bar reuse the dashboard path and onboarding progress language.
5. **Interaction rows — matched.** Answer choices use the same flat bordered-row family as dashboard tasks and score-choice fields, with code-native labels and focusable radio controls.
6. **Responsive behavior — matched.** Desktop keeps the rail beside the question; mobile compresses section progress to one row and retains zero horizontal overflow.
7. **Above-the-fold copy — intentional extension.** Only workflow-required diagnostic copy was added: form title, save/exit, section progress, question count, skill label, stimulus, prompt, choices, and navigation. No decorative badge, hero kicker, fake metric, or unrelated product claim was introduced.
8. **Intentional deviation — no score rail during testing.** Scores remain hidden before submission, so the dashboard score panel becomes section completion; estimated ranges appear only on the result surface.
