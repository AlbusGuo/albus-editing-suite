# Editing Suite

English | [简体中文](README.md)

Editing Suite is an Obsidian plugin that improves the writing experience while keeping Markdown files portable. It provides editor typography, table, link, math, code, divider, and supplemental syntax features.

*Make editing and reading feel like the same page.*

## Core features

### Editor basics

- Adjust the document width with a slider
- Hold `Alt` and use the mouse wheel to adjust the width quickly
- Collapse heading hash markers in Live Preview and reveal them at the heading start
- Fold trailing or directly attached `^id` block IDs until their owning block is selected
- Show a focus indicator for the active line, heading level, and nested list level
- Use `Edit and reading mode alignment (Experimental)` to align common block spacing and positions

### Per-note fonts

Use the `font` or `字体` property to select a font for the current note:

```yaml
---
font: Microsoft YaHei
---
```

The Chinese property name is supported as an alias:

```yaml
---
字体: SimSun
---
```

The property value input can search installed system fonts and preview each suggestion. The font applies only to the current note in both editing and reading modes. If both properties are present, `font` takes precedence.

### Tables

- Control full-width and centered tables independently
- Choose between the default, rounded grid, and three-line styles
- Preserve Obsidian's native table editing and drag interactions

### Links

- Keep Obsidian's default link style
- Optionally use the red outline style
- Apply the selected style in both editing and reading modes

### Math

- Adjust vertical margins around display math
- Allow wide display math to scroll horizontally
- Normalize spacing around equations containing `\tag`

### Code

- Refine inline code styling
- Copy inline code by clicking it in Reading View and show copy feedback
- Add a title bar, language name, and language icon to code blocks
- Support line numbers, long-line wrapping, and the native copy button
- Keep the code block structure consistent between editing and reading modes

### Dividers

- Keep Obsidian's default divider
- Optionally use the diamond gradient style
- Trigger hover feedback from the entire divider

## Supplemental syntax

### Colored text

Colored text uses bold syntax with a circular Emoji marker:

```md
**🟡Yellow text**
**🟢Green text**
**🔴Red text**
**🟠Orange text**
**🟣Purple text**
**🔵Blue text**
```

Only the text color is retained by default. Enable `Keep bold` to preserve the bold weight as well. Ordinary bold text is unaffected.

### Colorful highlights

Colorful highlights extend Obsidian's `==text==` syntax:

```md
==🟡Yellow highlight==
==🟢Green highlight==
==🔴Red highlight==
==🟠Orange highlight==
==🟣Purple highlight==
==🔵Blue highlight==
```

The color Emoji is hidden in Live Preview and Reading View. On Obsidian 1.14 and later, focusing the range shows Obsidian's interactive color swatch. Ordinary `==highlight==` syntax keeps Obsidian's default style.
The underline wave can be disabled independently without changing the color background or swatch interaction.

### Cloze

The black circular Emoji distinguishes cloze content from colorful highlights:

```md
==⚫Hidden answer==
```

Cloze content is concealed by default and can be revealed through pointer, keyboard, or editing interactions.

### Negative headings

Use Discord-style `-# ` syntax for compact, muted headings:

```md
-# Negative heading
-# Supports **bold**, *italic*, links, and $E=mc^2$
- -# Negative heading in a list
> -# Negative heading in a quote
\-# Escaped as ordinary text
```

The `Smart toggle negative heading` command supports single lines, multi-line selections, lists, and quotes while skipping code blocks, math blocks, and Frontmatter.

### Sidenotes

Use the following syntax to place a note beside the main text:

```md
Main text{{📝This is a sidenote}}
```

- Numbered automatically in document order
- Anchored to the corresponding text and moved down when notes overlap
- Configurable for the left or right side
- Presented in a popover when horizontal space is insufficient
- Supports Markdown, math, and image rendering
- Converted to footnotes when printing or exporting to PDF
- Nested sidenotes are not supported

### Custom ordered lists

Add a marker directive to the first item of an ordinary Markdown ordered list:

```md
1. {a)} First item
2. Second item
3. Third item

1. {I.} First item
2. Second item

1. {Article 3} First item
2. Second item
```

Numeric, upper- and lowercase alphabetic, upper- and lowercase Roman, and custom prefix or suffix formats are supported. The underlying document remains an Obsidian ordered list, preserving native indentation, folding, and list interactions.

Append `-` after the marker directive to remove the visual spacing between the list and adjacent content. This works in the main document, quotes, Callouts, and nested lists, independently of experimental mode alignment:

```md
> [!note]
> Callout content
>
> 1. {(1)}- First item
> 2. Second item
```

## Settings

The settings interface contains two pages:

- `Editor`: Document width, per-note fonts, heading markers, focus indicator, mode alignment, tables, links, math, code, and dividers
- `Extensions`: Colored text, colorful highlights, cloze, negative headings, sidenotes, and custom lists

Feature toggles and style options apply immediately after they are saved.

## Installation

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css`
2. Create `<Vault>/.obsidian/plugins/albus-editing-suite/`
3. Place the three files in that directory
4. Reload Obsidian
5. Enable Editing Suite under `Settings -> Community plugins`

When upgrading, replace the three release files and keep `data.json` to preserve your settings.

### Build from source

```bash
npm install
npm run lint
npm run build
```

The production bundle is generated as `main.js` in the project root.

## Compatibility and privacy

- Requires Obsidian `1.13.0` or later
- Uses local APIs provided by Obsidian and CodeMirror
- Contains no telemetry, analytics, advertisements, or remote services
- Does not send note contents, file names, or settings to external servers
- `Edit and reading mode alignment` is experimental and may be affected by complex themes or other typography plugins

## Acknowledgments and licenses

- The README information structure is inspired by [Home Tab Plus](https://github.com/Moyf/home-tab-plus) by [Moyf](https://github.com/Moyf)
- The negative heading feature is based on and modified from [Negative Heading](https://github.com/cyne-wulf/obsidian-negative-heading) by Ashan Devine / [cyne-wulf](https://github.com/cyne-wulf), licensed under `GPL-3.0-or-later`
- The colorful highlight feature is inspired by and modified from [Colorful Highlights](https://github.com/Moyf/colorful-highlights) by [Moyf](https://github.com/Moyf), licensed under the MIT License

This project is distributed under `AGPL-3.0-or-later`. Third-party copyright and license notices are available in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). See [LICENSE](LICENSE) for the complete project license.

## Development

The project uses TypeScript and esbuild. Feature modules live under `src/`, while `src/main.ts` is limited to lifecycle and feature registration. Run the following commands before submitting a change:

```bash
npm run lint
npm run build
```
