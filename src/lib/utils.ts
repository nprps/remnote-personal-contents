import { BuiltInPowerupCodes, RNPlugin, Rem, RemId } from '@remnote/plugin-sdk';

type Content = {
  [remId: RemId]: {
    depth: number;
    text: string;
    level?: number;
    children: Content[];
  };
};

export async function generateContents(root: Rem, plugin: RNPlugin, excludeH6 = true): Promise<Content[]> {
  const childrenRem = await root.getChildrenRem();
  const contents = await buildChildren(1, childrenRem, plugin, excludeH6, new Set([root._id]));
  return contents;
}

async function buildChildren(
  depth: number,
  childrenRem: Rem[],
  plugin: RNPlugin,
  excludeH6: boolean,
  visited: Set<RemId>
): Promise<Content[]> {
  const children = await Promise.all(
    childrenRem.map(async (child) => {
      if (visited.has(child._id)) return [];
      visited.add(child._id);
      const isHeader = await isHeaderRem(child);
      if (!isHeader) {
        // Ordinary notes are transparent to the outline, not subtree boundaries.
        return buildChildren(depth, await child.getChildrenRem(), plugin, excludeH6, visited);
      }

      const level = parseHeadingLevel(await child.getPowerupProperty(BuiltInPowerupCodes.Header, 'Size'));
      if (excludeH6 && (level === 5 || level === 6)) {
        // Omit the entry, not its descendants; promoted children keep the same visual depth.
        return buildChildren(depth, await child.getChildrenRem(), plugin, excludeH6, visited);
      }
      return [await buildContent(depth, child, plugin, excludeH6, visited, level)];
    })
  );

  return children.flat();
}

export function isSmallHeading(size: string | undefined): boolean {
  const level = parseHeadingLevel(size);
  return level === 5 || level === 6;
}

export function parseHeadingLevel(size: string | undefined): number | undefined {
  const match = typeof size === 'string' ? /^H?([1-6])$/i.exec(size.trim()) : null;
  return match ? Number(match[1]) : undefined;
}

async function buildContent(depth: number, rem: Rem, plugin: RNPlugin, excludeH6: boolean, visited: Set<RemId>, level?: number): Promise<Content> {
  const [id, text, childrenRem] = await extractAttributes(rem, plugin);
  const children = await buildChildren(depth + 1, childrenRem, plugin, excludeH6, visited);

  const content = {
    [id]: {
      depth,
      text,
      level,
      children,
    },
  };
  return content;
}

async function extractAttributes(
  rem: Rem,
  plugin: RNPlugin
): Promise<[id: string, text: string, children: Rem[]]> {
  const id = rem._id;
  const text = rem.text ? await plugin.richText.toString(rem.text) : '';
  const childrenRem = await rem.getChildrenRem();

  return [id, text, childrenRem];
}

async function isHeaderRem(rem: Rem): Promise<boolean> {
  return await rem.hasPowerup(BuiltInPowerupCodes.Header);
}

export type FlatContent = {
  id: RemId;
  depth: number;
  text: string;
  level?: number;
};
// convert nested Content to flat list
// - before: [{ [id_1]: { depth: 1, text: 'hoge', children: [ { [id_2]: ... }, { [id_3]: ... } ] }}, { [id_4]: ... }]
// - after: [{ id: id_1, depth: 1, text: 'hoge' }, { id: id_2, depth: 2, text: 'fuga' }, { id: id_3, depth: 2, text: 'piyo' }, { id: id_4, depth: 1, text: 'foo' } }]
export function convertContentsToFlatList(contents: Content[]): FlatContent[] {
  const flatContents = contents.flatMap((content) => {
    const [id, depth, text, children, level] = extractContent(content);
    return [{ id, depth, text, level }, ...convertContentsToFlatList(children)];
  });
  return flatContents;
}

function extractContent(
  content: Content
): [id: RemId, depth: number, text: string, children: Content[], level: number | undefined] {
  const id = Object.keys(content)[0];
  const depth = content[id].depth;
  const text = content[id].text;
  const children = content[id].children;

  return [id, depth, text, children, content[id].level];
}

export const expandHighestCollapsedAncestor = async (remId: RemId, plugin: RNPlugin) => {
  const pane = await plugin.window.getFocusedPaneId();
  const documentRemId = await plugin.window.getOpenPaneRemId(pane);

  let currentRem = await plugin.rem.findOne(remId);
  if (!currentRem || !documentRemId || documentRemId === currentRem._id) return;

  const collapsedAncestors: Rem[] = [];
  const visited = new Set<RemId>();
  // The target's own children do not need revealing to navigate to the target.
  currentRem = currentRem.parent ? await plugin.rem.findOne(currentRem.parent) : undefined;
  while (currentRem && currentRem._id !== documentRemId) {
    if (visited.has(currentRem._id)) break;
    visited.add(currentRem._id);
    const isCollapsed = await currentRem.isCollapsed(documentRemId);
    if (isCollapsed) {
      collapsedAncestors.push(currentRem);
    }
    currentRem = currentRem.parent ? await plugin.rem.findOne(currentRem.parent) : undefined;
  }

  for (const ancestor of collapsedAncestors.reverse()) {
    await ancestor.expand(documentRemId, false);
  }
};

export function isMobileOs(os: string): boolean {
  return os === 'ios' || os === 'android';
}
