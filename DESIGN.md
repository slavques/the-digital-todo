# Quiet List design system

The accepted direction is a precise, compact working interface: contrast, predictable controls, and one restrained accent. This is an Operate surface, not a marketing page.

- Preserve the product name, local Onest family, blue identity and the four required task actions.
- The working object is a connected task queue. The heading, filters and progress, visible entry label, task rows and storage status form one surface.
- No promotional hero, decorative metric, invented project navigation, ambient animation or sample tasks on first use.
- Use role tokens from tokens.css. Light and dark palettes have separate surface, ink, border, focus, action and error values. Never invert the page.
- Keep the fixed rem type scale. Task text is 16px; labels and metadata are 13–14px. Do not reintroduce fluid display headings.
- The primary fill is reserved for Add. Other controls use type, neutral surfaces or state. Task completion also uses a checkbox and strikethrough.
- Keep the spacing scale and one control family. On narrow screens the entry row stacks; theme controls remain discoverable.
- Theme preference is system, light or dark. Set the actual mode before CSS paints; save it separately from task data. System changes affect only the system preference.
- Support empty, populated, filtered, error and restored states. Task and theme storage failures are independent. Operations are local and synchronous, so no artificial loading UI is needed.
- Deletion has a single undo action. Restore task identity, completion and order; clear undo on a subsequent task mutation, external task update or reload.
- Motion only explains progress changes. Focus is immediate, all controls work from the keyboard, and reduced motion is respected.

Verification: real desktop and narrow-screen views in both modes; keyboard, persistence, error and undo interactions; independent visual and code reviews; numeric contrast checks and automated axe checks. Source detectors complement the rendered review and do not establish a complete accessibility certification.
