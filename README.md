# Personal Contents for RemNote

A personal, sandboxed fork of [Table of Contents by plant / toxoxi](https://github.com/toxoxi/remnote-table-of-contents), based on upstream commit `72def364c51c9c389d8cbbed48dccec74471e64e`. The upstream MIT licence is retained in LICENSE.

## Behaviour

- Shows a contents list in RemNote's desktop right sidebar (mobile layout is configured but not yet tested).
- Excludes H5 and H6 by default; their visible heading descendants remain discoverable.
- Finds headings beneath ordinary notes, preserving document order. Ordinary notes and filtered headings do not add outline indentation.
- Supports heading nesting beyond the original four-level cutoff, with cycle guards.
- Renders nothing when the document has no included headings.
- Uses equal 18px Lexend text, weight 405, grey text and short heading accents: H1 red, H2 purple, H3 blue, H4 green.
- Clicking a heading reveals only its collapsed ancestors, outside-in and non-recursively, then navigates to it inside the document.

## Permissions and privacy

Native mode is not requested. All / ReadCreateModify is required because RemNote treats unfolding a parent as a modification. The plugin code uses this permission to expand collapsed ancestors; it does not create, edit or delete note content. No delete scope is requested.

Notes are read through RemNote's SDK and rendered locally in the plugin iframe. No note content is sent to an external API. The Lexend font stylesheet is requested from Google Fonts.

## Development and validation

Install dependencies using `npm ci`. Run `npx tsc --noEmit` and `node --test test/heading-filter.cjs`. Start the local server with `npm run dev`; the development configuration listens only on 127.0.0.1:8782 with browser launch and development websockets disabled. Use RemNote's Develop from localhost option.

For a production build, set NODE_ENV to production and run webpack with webpack.config.js. Package the contents of dist at the root of a ZIP and upload through RemNote's Plugins > Build screen. The manifest sets unlisted=true; RemNote approval is still required for distribution.

## Verification and remaining limits

The filter, traversal and ancestor-path logic have SDK-shaped mock regression tests. The built-in RemNote browser was used to verify real H5/H6 filtering, headings beneath an ordinary parent, nested H3/H4, a collapsed-parent navigation case, and a truly blank empty state. These checks are not a guarantee of every Desktop, mobile or portal configuration.

The upstream whole-document reactive subscription remains broad. Large-document performance has not been benchmarked. Portal-specific discovery and navigation need dedicated validation. Loading currently shares the requested blank presentation with an empty outline. The host may display an undefined widget tab label with the pinned SDK despite the configured title.
