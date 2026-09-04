# Design System: Provera Quiz/Exam Proctoring Platform

## 1. Color Tokens

| Token | Hex | Usage |
|---|---|---|
| Background | `#F7F9FC` | Page background |
| Card | `#FFFFFF` | Cards, panels, modals, elevated surfaces |
| Primary | `#2563EB` | Primary buttons, links, active states, key CTAs (e.g. "Start Exam") |
| Primary light | `#DBEAFE` | Primary hover/subtle backgrounds, selected states, badges |
| Navy text | `#172554` | Headings, high-emphasis text |
| Body text | `#475569` | Paragraphs, secondary/body copy |
| Border | `#E2E8F0` | Dividers, input borders, card outlines |
| Success | `#16A34A` | "Normal" student status, successful actions, correct answers |
| Warning | `#D97706` | Minor proctoring flags (poor lighting, face partially obscured) |
| Danger | `#DC2626` | Major proctoring flags (face not recognized, multiple faces), destructive actions (delete room) |

## 2. Usage by Context

### Student: Exam Page
- Default state: `Background` + `Card` for the question panel, `Body text` for question prompts, `Primary` for the submit/next button.
- Proctoring warning (minor): border/icon in `Warning`, non-blocking notification.
- Proctoring violation (major): full-screen blur overlay, `Danger` accent on the "Face not recognized" / "Face not detected" message.

### Lecturer: Room Dashboard
- Student list: each row shows a status dot, either `Success` (normal), `Warning` (minor flag active), or `Danger` (major flag / needs review).
- Live violation notification toast: `Danger` background tint for major cases, `Warning` for minor.
- Room controls (Start / Extend / End Early): `Primary` for Start & Extend, `Danger` (outline or ghost style) for End Early and Delete Room to signal a more consequential action.

### Admin
- Neutral, data-dense screens: `Background`/`Card`/`Border` structure, `Primary` reserved for actionable items only (avoid overusing accent colors on management screens).

## 3. Typography Pairing Notes
- `Navy text` (#172554) on `Background`/`Card` gives strong contrast for headings, safe for exam instructions and question prompts that need to be read carefully.
- `Body text` (#475569) for anything secondary, such as timestamps, helper text, or question numbering, so it doesn't compete with primary content.

## 4. Do / Don't
- **Do** reserve `Danger` strictly for destructive actions and major proctoring flags; don't reuse it for generic emphasis, or it loses urgency.
- **Do** use `Primary light` for subtle highlighting (e.g. currently-selected multiple-choice option) instead of full `Primary`, which should stay reserved for buttons/CTAs.
- **Don't** introduce additional hues outside this palette without a clear semantic reason, since the whole point of this system is a small, predictable set of meanings per color.