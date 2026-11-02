import {
  AppEvents,
  declareIndexPlugin,
  ReactRNPlugin,
  RemId,
  WidgetLocation,
} from '@remnote/plugin-sdk';
import '../style.css';
import '../App.css';
import { isMobileOs } from '../lib/utils';

async function onActivate(plugin: ReactRNPlugin) {
  await plugin.settings.registerBooleanSetting({
    id: 'exclude-h6',
    title: 'Exclude H5 and H6 from contents',
    description: 'Reserve H5 and H6 for small notes. Other headings directly beneath them remain visible.',
    defaultValue: true,
  });
  // Register a sidebar widget.
  const os = await plugin.app.getOperatingSystem();

  const location = isMobileOs(os) ? WidgetLocation.LeftSidebar : WidgetLocation.RightSidebar;

  await plugin.app.registerWidget('table_of_contents', location, {
    dimensions: { height: 'auto', width: '100%' },
    widgetTabIcon: `${plugin.rootURL}toc_icon.png`,
    widgetTabTitle: 'Personal Contents',
  });

  plugin.event.addListener(AppEvents.GlobalOpenRem, undefined, async (message) => {
    const remId = message.remId as RemId;
    await plugin.storage.setLocal('TOC_lastOpenedRemId', remId);
  });
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);
