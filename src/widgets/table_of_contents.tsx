import { renderWidget, usePlugin, useTracker, RemId } from '@remnote/plugin-sdk';
import '../style.css';
import '../App.css';
import {
  convertContentsToFlatList,
  expandHighestCollapsedAncestor,
  generateContents,
} from '../lib/utils';

export const TableOfContentsWidget = () => {
  const plugin = usePlugin();
  const lastOpenedRemId = useTracker(async (reactivePlugin) => {
    return await reactivePlugin.storage.getLocal('TOC_lastOpenedRemId');
  });
  const contents =
    useTracker(
      async (reactivePlugin) => {
        const paneId = await reactivePlugin.window.getFocusedPaneId();
        const remId = await reactivePlugin.window.getOpenPaneRemId(paneId);
        const rem = await reactivePlugin.rem.findOne(remId);
        if (!rem) return [];
        await rem.allRemInDocumentOrPortal(); // track the changes of all rems
        const excludeH6 = await reactivePlugin.settings.getSetting<boolean>('exclude-h6');
        return await generateContents(rem, reactivePlugin, excludeH6 !== false);
      },
      [lastOpenedRemId]
    ) || [];

  if (contents.length === 0) {
    return null;
  }

  const flatContents = convertContentsToFlatList(contents);

  const jumpToRem = async (remId: RemId) => {
    // Reveal only the ancestor path; do not recursively expand unrelated branches.
    await expandHighestCollapsedAncestor(remId, plugin);
    const rem = await plugin.rem.findOne(remId);
    const parentRemId = await plugin.window.getOpenPaneRemId(
      await plugin.window.getFocusedPaneId()
    );
    await rem?.openRemInContext(parentRemId);
  };

  return (
    <nav className="toc-panel">
      <h1 className="toc-title">Contents</h1>
      <hr className="toc-divider" />
      <ul className="toc-list">
        {flatContents.map((content, i) => (
          <li key={`${content.id}_${i}`} className={`toc-level-${content.level ?? 'unknown'}`} style={{ marginLeft: (content.depth - 1) * 16 }}>
            <a
              key={`${content.id}_${i}`}
              href="#"
              onClick={async (event) => {
                event.preventDefault();
                await jumpToRem(content.id);
              }}
              className="toc-link"
            >
              {content.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};

renderWidget(TableOfContentsWidget);
