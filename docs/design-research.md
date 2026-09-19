# JRISC: instruction-first redesign

## What the first view needs to communicate

The distinctive thing is a tiny instruction set containing an operation for semantic judgment. A generic prompt box followed by many equal-weight debugging panels obscured that idea. The new reading order is: **the hook → all 16 instructions → a complete 12-instruction program → its visible result → deeper inspection → optional natural-language composition.**

## Research and decisions

1. **Guide attention with scale, grouping and contrast.** Nielsen Norman Group's [visual hierarchy guidance](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/) recommends establishing the content hierarchy before styling and making importance visible through scale, contrast and grouping. Here the headline states the distinction, the opcode keyboard groups the entire ISA, and lavender consistently marks JUDGE. The effect should be evaluated with users; the redesign itself is not evidence of higher conversion.
2. **Expose the core first, advanced controls on demand.** NN/G's [progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) describes showing primary capabilities first and moving less-used details to secondary views. The complete small program, Run, Step, Reset and message input stay visible. Registers, editing and replay sit in “Open the machine”; typed distributions have their own disclosure. These remain available without a separate page.
3. **Make the hook specific and resolve it quickly.** [X creative guidance](https://business.x.com/en/advertising/creative-best-practices) emphasizes clear key messages, early movement and sound-off readability. “16 instructions. One understands.” states a concrete constraint and an unexpected capability; the key marked JUDGE immediately explains the claim. It is a design hypothesis, not a claim of guaranteed attention or virality. Motion is subtle and disabled with reduced-motion preferences.
4. **Use a theme that belongs to the product.** [PICO-8's fantasy-console model](https://www.lexaloffle.com/pico-8.php) makes constrained computing approachable and playful. This inspired a distinct computer-manual treatment: warm paper, raised opcode keys, cartridge presets, an original pixel-chip illustration and a framed pixel display. JRISC does not use PICO-8 assets or imply compatibility. Pixel type is limited to branding and headings; normal text and monospaced code retain legibility.

## Interaction details

- Each of the 16 opcode keys explains its operation, shows actual JRISC syntax and a concrete effect. Keys work with pointer, Tab/Enter and arrow keys. Selected state is explicit, and matching program opcodes are underlined.
- The default Feeling machine is a complete 12-instruction program, including display initialization, JUDGE, a memory read, unknown-outcome branch, palette write and loop. Each line has an annotation; a live explanation describes the next instruction.
- The screen consumes real VM memory. No mocked semantic results or speculative performance numbers were added. Runtime decisions remain four questions in one live Jev request.
- A status explicitly distinguishes “awaiting input” from “asking Jev.” The message stays visible above the four returned decisions.
- The layout stacks at narrow widths, preserves all 16 instructions, includes focus indicators, and honors reduced motion for CSS and canvas animation.

## Verification

The 12-line program is exercised for warm, storm and unknown outcomes. Browser checks cover instruction keys and keyboard navigation, real API decisions and display writes, stepping/reset, replay without inference, compilation, static presets, unsupported requests, and mobile overflow. Desktop and mobile captures are in artifacts/redesign-*.png. These are functional and visual checks, not a usability study or a measured hook-performance test.
