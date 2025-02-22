import { BBAuth } from '../auth';

import { BBAuthInterop } from '../shared/interop';

import { BBAuthNavigator } from '../shared/navigator';

import { BBAuthDomUtility } from '../shared/dom-utility';

import { BBOmnibarBranding } from './branding';

import { BBOmnibarConfig } from './omnibar-config';

import { BBOmnibarNavigationItem } from './omnibar-navigation-item';

import { BBOmnibarNotificationItem } from './omnibar-notification-item';

import { BBOmnibarSearchArgs } from './omnibar-search-args';

import { BBOmnibarSetTitleArgs } from './omnibar-set-title-args';

import { BBOmnibarUserActivity } from './omnibar-user-activity';

import { BBOmnibarUserActivityPrompt } from './omnibar-user-activity-prompt';

import { BBOmnibarUpdateArgs } from './omnibar-update-args';

import { BBOmnibarPushNotifications } from './omnibar-push-notifications';

import { BBOmnibarToastContainer } from './omnibar-toast-container';

import { BBOmnibarVertical } from './omnibar-vertical';

import { BBOmnibarThemeAccent } from './theming';

const CLS_EXPANDED = 'sky-omnibar-iframe-expanded';
const CLS_LOADING = 'sky-omnibar-loading';
const CLS_ENVIRONMENT_VISIBLE = 'sky-omnibar-environment-visible';
const CLS_ENVIRONMENT_DESCRIPTION_VISIBLE =
  'sky-omnibar-environment-description-present';
const HOST_ID = 'omnibar';
const OMNIBAR_HEIGHT = 50;
const ENVIRONMENT_HEIGHT = 24;

let envEl: HTMLDivElement;
let envNameEl: HTMLSpanElement;
let envDescEl: HTMLSpanElement;
let placeholderEl: HTMLDivElement;
let styleEl: HTMLStyleElement;
let iframeEl: HTMLIFrameElement;
let omnibarConfig: BBOmnibarConfig;
let currentLegacyKeepAliveUrl: string;
let promiseResolve: () => void;
let unreadNotificationCount: number;
let serviceName: string;
let currentTitleParts: string[];

function addIframeEl(): void {
  iframeEl = BBAuthDomUtility.addIframe(
    buildOmnibarUrl(),
    `sky-omnibar-iframe ${CLS_LOADING}`,
    'Navigation'
  );
}

function isModernTheme(): boolean {
  const qs = parseQuerystring();
  if (qs.modernnav === '1') {
    return true;
  }

  const theme = omnibarConfig.theme;
  return theme && theme.name === 'modern';
}

function handleEnvironmentElTheme(isModern: boolean): void {
  const defaultThemeClass = 'sky-omnibar-environment-theme-default';
  const modernThemeClass = 'sky-omnibar-environment-theme-modern';

  if (isModern) {
    envEl.classList.remove(defaultThemeClass);
    envEl.classList.add(modernThemeClass);
  } else {
    envEl.classList.remove(modernThemeClass);
    envEl.classList.add(defaultThemeClass);
  }
}

function addEnvironmentEl(): void {
  envEl = document.createElement('div');
  envEl.className = 'sky-omnibar-environment';
  handleEnvironmentElTheme(isModernTheme());

  envNameEl = document.createElement('span');
  envNameEl.className = 'sky-omnibar-environment-name';
  envEl.appendChild(envNameEl);

  envDescEl = document.createElement('span');
  envDescEl.className = 'sky-omnibar-environment-description';
  envEl.appendChild(envDescEl);

  BBAuthDomUtility.addElToBodyTop(envEl);
}

function collapseIframe(): void {
  iframeEl.classList.remove(CLS_EXPANDED);
}

function showVerticalNav(): boolean {
  if (isModernTheme()) {
    if (omnibarConfig.svcId === 'tcs') {
      return true;
    }

    const qs = parseQuerystring();
    return qs.leftnav === '1';
  }

  return false;
}

function parseQuerystring(): Record<string, string> {
  const queryParams: Record<string, string> = {};
  let qs = BBAuthInterop.getCurrentUrl().split('?')[1];
  if (qs) {
    if (qs.indexOf('#') >= 0) {
      qs = qs.split('#')[0];
    }
    for (const p of qs.split('&')) {
      const param = p.split('=');
      const key = param[0];
      const value = param[1];
      queryParams[key] = value;
    }
  }
  return queryParams;
}

function addStyleEl(): void {
  let accentCss =
    'background: linear-gradient(to right, #71bf44 0, #31b986 50%, #00b2ec 100%);';
  let accentHeight = '5px';
  let backgroundColor = '#4d5259';
  let borderBottom = 'none';

  const theme = omnibarConfig.theme;

  if (theme) {
    if (isModernTheme()) {
      accentHeight = '4px';
      backgroundColor = '#fff';
      borderBottom = 'solid 1px #e2e3e4';
    }

    const accent = theme.accent;

    backgroundColor = theme.backgroundColor || backgroundColor;

    // Explicitly check for false here since undefined represents the default
    // behavior of showing the accent with the default color.
    if (accent === false) {
      accentCss = 'display: none;';
    } else if (accent && (accent as BBOmnibarThemeAccent).color) {
      accentCss = `background-color: ${
        (accent as BBOmnibarThemeAccent).color
      };`;
    }
  }

  styleEl = BBAuthDomUtility.addCss(`
body {
  margin-top: ${OMNIBAR_HEIGHT}px;
}

#bb-help-container {
  padding-top: 1px;
}

.sky-omnibar-iframe,
.sky-omnibar-placeholder {
  border: none;
  height: ${OMNIBAR_HEIGHT}px;
  width: 100%;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
}

.sky-omnibar-placeholder {
  background-color: ${backgroundColor};
  border-bottom: ${borderBottom};
  display: none;
}

.sky-omnibar-placeholder-accent {
  height: ${accentHeight};
  ${accentCss}
}

.sky-omnibar-placeholder.${CLS_LOADING} {
  display: block;
}

.sky-omnibar-iframe.${CLS_LOADING} {
  visibility: hidden;
}

.${CLS_EXPANDED} {
  height: 100%;
}

.sky-omnibar-environment {
  font-family: "Blackbaud Sans", "Open Sans", "Helvetica Neue", Arial, sans-serif;
  font-size: 12px;
  font-weight: 400;
  height: 0;
  line-height: ${ENVIRONMENT_HEIGHT}px;
  overflow: hidden;
  padding: 0 15px;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sky-omnibar-environment-theme-default {
  background-color: #e1e1e3;
  color: #282b31;
}

.sky-omnibar-environment-theme-modern {
  background-color: transparent;
  color: inherit;
}

.sky-omnibar-environment-description {
  margin-left: 15px;
  font-weight: bold;
}

.${CLS_ENVIRONMENT_DESCRIPTION_VISIBLE} {
  background-color: #ffeccf;
  border-bottom: 2px solid #fbb034;
  color: #282b31;
}

.${CLS_ENVIRONMENT_VISIBLE} .sky-omnibar-environment {
  height: ${ENVIRONMENT_HEIGHT}px;
}
`);

  updateSize();
}

function addPlaceholderEl(): void {
  placeholderEl = document.createElement('div');
  placeholderEl.className = `sky-omnibar-placeholder ${CLS_LOADING}`;
  placeholderEl.innerHTML = `<div class="sky-omnibar-placeholder-accent"></div>`;

  document.body.appendChild(placeholderEl);
}

function expandIframe(): void {
  iframeEl.classList.add(CLS_EXPANDED);
}

function handleStateChange(): void {
  const url = BBAuthInterop.getCurrentUrl();
  const path = BBAuthInterop.getCurrentPath();

  const routeInfo = omnibarConfig.getRouteDetails?.({
    href: url,
    pathname: path,
  });

  BBAuthInterop.postLocationChangeMessage(iframeEl, url, routeInfo?.category);

  BBOmnibarToastContainer.updateUrl(url);
  BBOmnibarVertical.updateUrl(url, routeInfo?.category);
}

async function handleSearch(searchArgs: BBOmnibarSearchArgs): Promise<void> {
  if (omnibarConfig.onSearch) {
    const results = await omnibarConfig.onSearch(searchArgs);

    BBAuthInterop.postOmnibarMessage(iframeEl, {
      messageType: 'search-results',
      results,
    });
  }
}

function updateSize(): void {
  if (omnibarConfig.onResize) {
    omnibarConfig.onResize({
      position: 'top',
      size:
        OMNIBAR_HEIGHT +
        (document.body.classList.contains(CLS_ENVIRONMENT_VISIBLE) ? 24 : 0),
    });
  }
}

function openPushNotificationsMenu(): void {
  BBAuthInterop.postOmnibarMessage(iframeEl, {
    messageType: 'push-notifications-open',
  });
}

function notificationsCallback(notifications: {
  notifications: {
    isRead: boolean;
  }[];
}): void {
  BBAuthInterop.postOmnibarMessage(iframeEl, {
    messageType: 'push-notifications-update',
    pushNotifications: notifications,
  });

  BBOmnibarToastContainer.showNewNotifications(notifications);

  unreadNotificationCount =
    notifications &&
    notifications.notifications &&
    notifications.notifications.filter((notification) => !notification.isRead)
      .length;

  updateTitle();
}

function customMessageCallback(message: { value: string }): void {
  BBOmnibarVertical.refreshSettings(message.value);
}

async function connectPushNotifications(
  checkLoggedIn?: boolean
): Promise<void> {
  if (checkLoggedIn) {
    try {
      await BBAuth.getToken({
        disableRedirect: true,
      });
    } catch (err) {
      return;
    }
  }

  if (omnibarConfig) {
    await BBOmnibarPushNotifications.connect({
      customMessageCallback,
      envId: omnibarConfig.envId,
      handleNavigate,
      handleNavigateUrl,
      handlePushNotificationsChange,
      leId: omnibarConfig.leId,
      notificationsCallback,
      openPushNotificationsMenu,
      showVerticalNav: showVerticalNav(),
      svcId: omnibarConfig.svcId,
    });
  }
}

function disconnectPushNotifications(): void {
  BBOmnibarPushNotifications.disconnect();
}

async function refreshUserCallback(): Promise<void> {
  BBAuth.clearTokenCache();

  let token: string;

  try {
    token = await BBAuth.getToken({
      disableRedirect: true,
      forceNewToken: true,
    });
  } catch (err) {
    /* Let token remain undefined */
  }

  BBAuthInterop.postOmnibarMessage(iframeEl, {
    messageType: 'refresh-user',
    token,
  });

  if (showVerticalNav()) {
    BBOmnibarVertical.refreshUser(token);
  }

  if (token) {
    connectPushNotifications();
  } else {
    disconnectPushNotifications();
  }
}

function showInactivityCallback(): void {
  BBOmnibarUserActivityPrompt.show({
    sessionRenewCallback: () => {
      BBOmnibarUserActivity.userRenewedSession();
    },
  });
}

function hideInactivityCallback(): void {
  BBOmnibarUserActivityPrompt.hide();
}

function startActivityTracking(): void {
  BBOmnibarUserActivity.startTracking(
    refreshUserCallback,
    showInactivityCallback,
    hideInactivityCallback,
    omnibarConfig.allowAnonymous,
    currentLegacyKeepAliveUrl
  );
}

function handleHelp(): void {
  const BBHELP = window.BBHELP;

  if (BBHELP) {
    BBHELP.HelpWidget.open();
  }
}

function handleNotificationRead(notification: BBOmnibarNotificationItem): void {
  const notificationsConfig = omnibarConfig.notifications;

  if (notificationsConfig && notificationsConfig.onNotificationRead) {
    notificationsConfig.onNotificationRead(notification);
  }
}

function handlePushNotificationsChange(notifications: unknown[]): void {
  BBOmnibarPushNotifications.updateNotifications(notifications);
}

function handleEnvironmentUpdate(
  name: string,
  description: string,
  url: string
): void {
  const bodyClassList = document.body.classList;

  name = name || '';

  envNameEl.innerText = name;

  if (name) {
    bodyClassList.add(CLS_ENVIRONMENT_VISIBLE);

    if (description) {
      envEl.classList.add(CLS_ENVIRONMENT_DESCRIPTION_VISIBLE);

      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.innerText = description;
        envDescEl.appendChild(a);
      } else {
        envDescEl.innerText = description;
      }
    } else {
      envEl.classList.remove(CLS_ENVIRONMENT_DESCRIPTION_VISIBLE);
    }
  } else {
    bodyClassList.remove(CLS_ENVIRONMENT_VISIBLE);
  }

  updateSize();
}

function handleBrandingUpdate(branding: BBOmnibarBranding): void {
  const favIconUrl = branding?.images?.favIcon?.url;
  if (favIconUrl) {
    // Update the hrefs that we can support.
    document
      .querySelectorAll<HTMLLinkElement>(
        "link[rel='icon'], link[rel='apple-touch-icon']"
      )
      .forEach((linkEl) => {
        linkEl.href = favIconUrl;
      });
    // Remove the elements that we can't support so there's no lingering default logo anywhere.
    document
      .querySelectorAll<HTMLLinkElement>(
        "link[rel='mask-icon'], link[rel='manifest']"
      )
      .forEach((linkEl) => {
        linkEl.remove();
      });
  }
}

function handleNavigate(navItem: BBOmnibarNavigationItem): void {
  BBAuthInterop.handleNavigate(omnibarConfig.nav, navItem);
}

function handleNavigateUrl(url: string): void {
  BBAuthNavigator.navigate(url);
}

function monkeyPatchState(): void {
  const oldPushState = history.pushState;
  const oldReplaceState = history.replaceState;

  function newPushState(...args: unknown[]) {
    const result = oldPushState.apply(history, args);

    handleStateChange();

    return result;
  }

  function newReplaceState(...args: unknown[]) {
    const result = oldReplaceState.apply(history, args);

    handleStateChange();

    return result;
  }

  history.pushState = newPushState;
  history.replaceState = newReplaceState;
}

function initLocalNotifications(): void {
  const notificationsConfig = omnibarConfig.notifications;

  if (notificationsConfig) {
    notificationsConfig.onReady({
      updateNotifications: (notifications) => {
        BBAuthInterop.postOmnibarMessage(iframeEl, {
          messageType: 'notifications-update',
          notifications,
        });
      },
    });
  }
}

function messageHandler(event: MessageEvent): void {
  const message = event.data;

  if (
    !BBAuthInterop.messageIsFromOmnibar(event) ||
    message.hostId !== HOST_ID
  ) {
    return;
  }

  const nav = omnibarConfig.nav;

  switch (message.messageType) {
    case 'ready':
      // Notify the omnibar of the host page's origin.  This MUST be the first
      // message that is posted to the omnibar because all other messages will
      // be validated against the provided origin.  If the origin of the host page
      // does not match a whilelist of allowed origins maintained by the omnibar,
      // further communications between the omnibar and host will be blocked.
      BBAuthInterop.postOmnibarMessage(iframeEl, {
        messageType: 'host-ready',
      });

      monkeyPatchState();

      BBAuthInterop.postOmnibarMessage(iframeEl, {
        compactNavOnly: omnibarConfig.compactNavOnly || showVerticalNav(),
        enableHelp: omnibarConfig.enableHelp,
        envId: omnibarConfig.envId,
        hideResourceLinks: omnibarConfig.hideResourceLinks,
        leId: omnibarConfig.leId,
        localNavItems: nav && nav.localNavItems,
        localNotifications: !!omnibarConfig.notifications,
        localSearch: !!omnibarConfig.onSearch,
        messageType: 'nav-ready',
        navVersion: omnibarConfig.navVersion,
        services: nav && nav.services,
        svcId: omnibarConfig.svcId,
        theme: omnibarConfig.theme,
      });

      initLocalNotifications();
      connectPushNotifications(true);

      handleStateChange();

      promiseResolve();
      break;
    case 'display-ready':
      placeholderEl.classList.remove(CLS_LOADING);
      iframeEl.classList.remove(CLS_LOADING);
      break;
    case 'expand':
      expandIframe();
      break;
    case 'collapse':
      collapseIframe();
      break;
    case 'navigate-url':
      handleNavigateUrl(message.url);
      break;
    case 'navigate':
      handleNavigate(message.navItem);
      break;
    case 'search':
      handleSearch(message.searchArgs);
      break;
    case 'get-token':
      BBAuthInterop.handleGetToken(
        iframeEl,
        message.tokenRequestId,
        message.disableRedirect,
        startActivityTracking
      );
      break;
    case 'help-open':
      handleHelp();
      break;
    case 'notification-read':
      handleNotificationRead(message.notification);
      break;
    case 'push-notifications-change':
      handlePushNotificationsChange(message.notifications);
      break;
    case 'session-renew':
      BBOmnibarUserActivity.userRenewedSession();
      break;
    case 'environment-update':
      handleEnvironmentUpdate(message.name, message.description, message.url);
      break;
    case 'branding-update':
      handleBrandingUpdate(message.branding);
      break;
    case 'legacy-keep-alive-url-change':
      currentLegacyKeepAliveUrl = message.url;
      startActivityTracking();
      break;
    case 'selected-service-update':
      serviceName = message.serviceName;
      updateTitle();
      break;
  }
}

function buildOmnibarUrl(): string {
  const omnibarUrl =
    omnibarConfig.url ||
    /* istanbul ignore next */
    'https://host.nxt.blackbaud.com/omnibar/';

  return (
    omnibarUrl + (omnibarUrl.indexOf('?') < 0 ? '?' : '&') + `hostid=${HOST_ID}`
  );
}

function updateTitle(): void {
  if (currentTitleParts) {
    const titleParts = currentTitleParts.slice();

    if (serviceName) {
      titleParts.push(serviceName);
    }

    let title = titleParts.join(' - ');

    if (unreadNotificationCount) {
      title = `(${unreadNotificationCount}) ${title}`;
    }

    document.title = title;
  }
}

export class BBOmnibar {
  public static load(config: BBOmnibarConfig): Promise<void> {
    omnibarConfig = omnibarConfig = config;

    // TODO: Deprecate this and only allow it to come from the legacy-keep-alive-url-change message
    // from the omnibar.
    currentLegacyKeepAliveUrl = omnibarConfig.legacyKeepAliveUrl;

    return new Promise<void>((resolve) => {
      promiseResolve = resolve;

      addStyleEl();
      addPlaceholderEl();

      // Add these in reverse order since each will be inserted at the top of the
      // document; this will ensure the proper order in the DOM.
      addEnvironmentEl();
      addIframeEl();

      if (showVerticalNav()) {
        BBOmnibarVertical.load(config, iframeEl);
      }

      window.addEventListener('message', messageHandler);
    });
  }

  public static update(args: BBOmnibarUpdateArgs): void {
    BBAuthInterop.postOmnibarMessage(iframeEl, {
      messageType: 'update',
      updateArgs: args,
    });

    if (args.theme) {
      handleEnvironmentElTheme(args.theme.name === 'modern');
    }
  }

  public static setTitle(args: BBOmnibarSetTitleArgs): void {
    currentTitleParts = args && args.titleParts;
    updateTitle();
  }

  public static async pushNotificationsEnabled(): Promise<boolean> {
    if (!omnibarConfig) {
      return Promise.resolve(false);
    }

    return BBOmnibarPushNotifications.pushNotificationsEnabled();
  }

  public static destroy(): void {
    BBOmnibarToastContainer.destroy();
    BBOmnibarPushNotifications.disconnect();

    BBAuthDomUtility.removeEl(placeholderEl);
    BBAuthDomUtility.removeEl(iframeEl);
    BBAuthDomUtility.removeEl(envEl);

    BBAuthDomUtility.removeCss(styleEl);

    window.removeEventListener('message', messageHandler);

    document.body.classList.remove(CLS_ENVIRONMENT_VISIBLE);

    omnibarConfig =
      styleEl =
      placeholderEl =
      iframeEl =
      envEl =
      envDescEl =
      envNameEl =
      promiseResolve =
      unreadNotificationCount =
      currentTitleParts =
      serviceName =
        undefined;
  }
}
