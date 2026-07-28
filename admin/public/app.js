'use strict';

const token = new URLSearchParams(window.location.search).get('token') || '';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  connectionPulse: $('#connectionPulse'),
  connectionLabel: $('#connectionLabel'),
  viewEyebrow: $('#viewEyebrow'),
  viewTitle: $('#viewTitle'),
  refresh: $('#refreshButton'),
  globalNewPost: $('#globalNewPost'),
  heroNewPost: $('#heroNewPost'),
  postCount: $('#postCount'),
  missingCover: $('#missingCover'),
  missingDescription: $('#missingDescription'),
  gitState: $('#gitState'),
  gitBranch: $('#gitBranch'),
  cname: $('#cnameValue'),
  nodeVersion: $('#nodeVersion'),
  hexoVersion: $('#hexoVersion'),
  themeVersion: $('#themeVersion'),
  recentPosts: $('#recentPosts'),
  previewToggle: $('#previewToggle'),
  previewLink: $('#previewLink'),
  postSearch: $('#postSearch'),
  postStatusFilter: $('#postStatusFilter'),
  postSort: $('#postSort'),
  postResultCount: $('#postResultCount'),
  postList: $('#postList'),
  newPost: $('#newPostButton'),
  editorEmpty: $('#editorEmpty'),
  postEditor: $('#postEditor'),
  editorMode: $('#editorMode'),
  saveState: $('#saveState'),
  reloadPost: $('#reloadPostButton'),
  savePost: $('#savePostButton'),
  postStatus: $('#postStatus'),
  historyButton: $('#historyButton'),
  realPreviewButton: $('#realPreviewButton'),
  postTitle: $('#postTitle'),
  postDate: $('#postDate'),
  postCategory: $('#postCategory'),
  postTags: $('#postTags'),
  postDescription: $('#postDescription'),
  descriptionCount: $('#descriptionCount'),
  postCover: $('#postCover'),
  postCoverPreview: $('#postCoverPreview'),
  pickPostCover: $('#pickPostCover'),
  postBody: $('#postBody'),
  markdownPreview: $('#markdownPreview'),
  wordCount: $('#wordCount'),
  mediaUpload: $('#mediaUpload'),
  mediaSearch: $('#mediaSearch'),
  mediaCount: $('#mediaCount'),
  mediaGrid: $('#mediaGrid'),
  mediaDialog: $('#mediaDialog'),
  mediaPickerGrid: $('#mediaPickerGrid'),
  imageWorkshopDialog: $('#imageWorkshopDialog'),
  workshopForm: $('#workshopForm'),
  workshopCanvas: $('#workshopCanvas'),
  workshopRatio: $('#workshopRatio'),
  workshopX: $('#workshopX'),
  workshopY: $('#workshopY'),
  workshopZoom: $('#workshopZoom'),
  workshopXValue: $('#workshopXValue'),
  workshopYValue: $('#workshopYValue'),
  workshopZoomValue: $('#workshopZoomValue'),
  workshopAlt: $('#workshopAlt'),
  workshopName: $('#workshopName'),
  visualForm: $('#visualForm'),
  indexImg: $('#indexImg'),
  defaultTopImg: $('#defaultTopImg'),
  defaultCover: $('#defaultCover'),
  avatar: $('#avatar'),
  visualDialog: $('#visualDialog'),
  visualConfirmation: $('#visualConfirmation'),
  confirmVisual: $('#confirmVisualButton'),
  deployButton: $('#deployButton'),
  deployDialog: $('#deployDialog'),
  deployConfirmation: $('#deployConfirmation'),
  confirmDeploy: $('#confirmDeployButton'),
  terminal: $('#terminalOutput'),
  clearLog: $('#clearLogButton'),
  jobLabel: $('#jobLabel'),
  refreshHealth: $('#refreshHealthButton'),
  healthSummary: $('#healthSummary'),
  healthQueue: $('#healthQueue'),
  healthIssueCount: $('#healthIssueCount'),
  refreshReleaseReport: $('#refreshReleaseReport'),
  releaseSummary: $('#releaseSummary'),
  releaseGroups: $('#releaseGroups'),
  historyDialog: $('#historyDialog'),
  historyList: $('#historyList'),
  historyDiff: $('#historyDiff'),
  previewDialog: $('#previewDialog'),
  themePreviewFrame: $('#themePreviewFrame'),
  deviceStage: $('#deviceStage'),
  socialPreview: $('#socialPreview'),
  socialPreviewImage: $('#socialPreviewImage'),
  socialPreviewTitle: $('#socialPreviewTitle'),
  socialPreviewDescription: $('#socialPreviewDescription'),
  previewExternalLink: $('#previewExternalLink'),
  toast: $('#toast'),
  commandButtons: $$('[data-action]'),
};

const viewMeta = {
  dashboard: ['EDITORIAL OVERVIEW', '内容总览'],
  posts: ['CONTENT LIBRARY', '文章管理'],
  media: ['VISUAL ASSETS', '素材库'],
  appearance: ['THEME DIRECTION', '外观设置'],
  health: ['CONTENT GOVERNANCE', '内容治理'],
  operations: ['BUILD & RELEASE', '检查与发布'],
};

const state = {
  currentStatus: null,
  posts: [],
  media: [],
  visuals: null,
  health: null,
  healthFilter: 'all',
  releaseReport: null,
  currentPost: null,
  isNewPost: false,
  dirty: false,
  pickerTarget: null,
  workshopMedia: null,
  workshopImage: null,
  selectedHistoryId: null,
  receivedEventIds: new Set(),
};

let toastTimer = null;

function api(path, options = {}) {
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Blog-Admin-Token': token,
      ...(options.headers || {}),
    },
  }).then(async (response) => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `请求失败（${response.status}）`);
    return body;
  });
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => elements.toast.classList.remove('is-visible'), 3600);
}

function setConnection(online, label) {
  elements.connectionPulse.classList.toggle('is-online', online);
  elements.connectionPulse.classList.toggle('is-error', !online);
  elements.connectionLabel.textContent = label;
}

function switchView(name, { updateHash = true } = {}) {
  if (!viewMeta[name]) name = 'dashboard';
  $$('.view').forEach((view) => view.classList.toggle('is-active', view.dataset.page === name));
  $$('.nav-item').forEach((item) => item.classList.toggle('is-active', item.dataset.view === name));
  [elements.viewEyebrow.textContent, elements.viewTitle.textContent] = viewMeta[name];
  if (updateHash) history.replaceState(null, '', `#${name}`);
  if (name === 'posts') loadPosts();
  if (name === 'media') loadMedia();
  if (name === 'appearance') loadVisuals();
  if (name === 'health') loadHealth();
  if (name === 'operations') loadReleaseReport();
}

function renderStatus(status) {
  state.currentStatus = status;
  elements.cname.textContent = status.project.cname;
  elements.postCount.textContent = status.project.posts;
  elements.missingCover.textContent = status.contentHealth?.missingCover ?? '—';
  elements.missingDescription.textContent = status.contentHealth?.missingDescription ?? '—';
  elements.gitState.textContent = status.git.clean ? '清爽' : `${status.git.changes ?? '?'} 处`;
  elements.gitBranch.textContent = status.git.branch;
  elements.nodeVersion.textContent = status.project.node;
  elements.hexoVersion.textContent = status.project.hexo;
  elements.themeVersion.textContent = status.project.theme.replace(/^[^\d]*/, '');
  elements.previewToggle.textContent = status.preview.active ? '停止预览' : '启动预览';
  elements.previewToggle.dataset.active = String(status.preview.active);
  elements.previewLink.classList.toggle('is-disabled', !status.preview.active);
  elements.previewLink.setAttribute('aria-disabled', String(!status.preview.active));

  const busy = Boolean(status.currentJob);
  for (const button of elements.commandButtons) button.disabled = busy;
  elements.deployButton.disabled = busy;
  elements.jobLabel.textContent = busy
    ? `RUNNING / ${status.currentJob.label.toUpperCase()}`
    : status.lastJob
      ? `${status.lastJob.success ? 'PASSED' : 'FAILED'} / ${status.lastJob.label.toUpperCase()}`
      : 'CONTROL ROOM / READY';
}

async function refreshStatus(silent = false) {
  try {
    const status = await api('/api/status');
    renderStatus(status);
    setConnection(true, '本机已连接');
  } catch (error) {
    setConnection(false, '连接失败');
    if (!silent) showToast(error.message);
  }
}

function formatDate(value, compact = false) {
  if (!value) return '未注明日期';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  return compact ? `${match[1]}.${match[2]}.${match[3]}` : `${match[1]} 年 ${Number(match[2])} 月 ${Number(match[3])} 日`;
}

function dateTimeLocal(value) {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  return match ? `${match[1]}T${match[2]}` : '';
}

function nowDateTimeLocal() {
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return now.toISOString().slice(0, 16);
}

function renderRecentPosts() {
  if (state.posts.length === 0) {
    elements.recentPosts.innerHTML = '<p class="empty-note">还没有文章。</p>';
    return;
  }
  elements.recentPosts.replaceChildren(...state.posts.slice(0, 5).map((post) => {
    const button = document.createElement('button');
    button.className = 'recent-item';
    button.type = 'button';
    button.innerHTML = `
      <span class="recent-item__date">${formatDate(post.date, true)}</span>
      <span><strong></strong><small></small></span>
      <span>↗</span>
    `;
    button.querySelector('strong').textContent = post.title;
    button.querySelector('small').textContent = [...post.categories, ...post.tags].slice(0, 3).join(' · ') || '未分类';
    button.addEventListener('click', () => {
      switchView('posts');
      openPost(post.id);
    });
    return button;
  }));
}

async function loadPosts(force = false) {
  if (state.posts.length > 0 && !force) {
    renderPostList();
    return;
  }
  try {
    const response = await api('/api/posts');
    state.posts = response.posts;
    renderPostList();
    renderRecentPosts();
  } catch (error) {
    elements.postList.innerHTML = `<p class="empty-note">${escapeHtml(error.message)}</p>`;
    showToast(error.message);
  }
}

function visiblePosts() {
  const query = elements.postSearch.value.trim().toLocaleLowerCase('zh-CN');
  const statusFilter = elements.postStatusFilter.value;
  const filtered = state.posts.filter((post) => {
    const haystack = [post.title, post.excerpt, ...post.categories, ...post.tags].join(' ').toLocaleLowerCase('zh-CN');
    return (statusFilter === 'all' || post.status === statusFilter) && (!query || haystack.includes(query));
  });
  return filtered.sort((left, right) => {
    if (elements.postSort.value === 'modified') return right.modifiedAt.localeCompare(left.modifiedAt);
    if (elements.postSort.value === 'title') return left.title.localeCompare(right.title, 'zh-CN');
    return String(right.date).localeCompare(String(left.date), 'zh-CN');
  });
}

function renderPostList() {
  const posts = visiblePosts();
  elements.postResultCount.textContent = `${posts.length} 篇文章`;
  if (posts.length === 0) {
    elements.postList.innerHTML = '<p class="empty-note">没有匹配的文章。</p>';
    return;
  }
  elements.postList.replaceChildren(...posts.map((post) => {
    const button = document.createElement('button');
    button.className = `post-list-item${state.currentPost?.id === post.id ? ' is-active' : ''}`;
    button.type = 'button';
    const category = post.categories[0] || '未分类';
    button.innerHTML = `
      <span class="post-list-item__meta"><span></span><span></span></span>
      <strong></strong><p></p><span class="post-list-item__tags"></span>
    `;
    const meta = button.querySelectorAll('.post-list-item__meta span');
    meta[0].textContent = category;
    meta[1].textContent = formatDate(post.date, true);
    button.querySelector('strong').textContent = post.title;
    button.querySelector('p').textContent = post.excerpt || '暂无摘要';
    const tagContainer = button.querySelector('.post-list-item__tags');
    const statusChip = document.createElement('span');
    statusChip.className = `status-badge status-badge--${post.status}`;
    statusChip.textContent = { draft: '草稿', pending: '待发布', published: '已发布' }[post.status] || post.status;
    tagContainer.append(statusChip);
    for (const tag of post.tags.slice(0, 3)) {
      const chip = document.createElement('span');
      chip.textContent = tag;
      tagContainer.append(chip);
    }
    button.addEventListener('click', () => openPost(post.id));
    return button;
  }));
}

function confirmDiscard() {
  return !state.dirty || window.confirm('当前文章有尚未保存的修改。确定放弃这些修改吗？');
}

async function openPost(id, force = false) {
  if (state.currentPost?.id === id && !state.isNewPost && !force) return;
  if (!confirmDiscard()) return;
  try {
    elements.savePost.disabled = true;
    const response = await api(`/api/posts/${encodeURIComponent(id)}`);
    state.currentPost = response.post;
    state.isNewPost = false;
    fillEditor(response.post);
    renderPostList();
  } catch (error) {
    showToast(error.message);
  } finally {
    elements.savePost.disabled = false;
  }
}

function fillEditor(post) {
  elements.editorEmpty.classList.add('is-hidden');
  elements.postEditor.classList.remove('is-hidden');
  elements.editorMode.textContent = state.isNewPost ? 'NEW MARKDOWN DRAFT' : `EDITING / ${post.fileName}`;
  elements.postTitle.value = post.fields.title;
  elements.postDate.value = dateTimeLocal(post.fields.date) || nowDateTimeLocal();
  elements.postCategory.value = post.fields.categories.join(', ');
  elements.postTags.value = post.fields.tags.join(', ');
  elements.postDescription.value = post.fields.description;
  elements.postCover.value = post.fields.cover;
  elements.postStatus.value = post.fields.status || post.status || 'draft';
  elements.postBody.value = post.body;
  elements.historyButton.disabled = state.isNewPost;
  markClean();
  updateEditorMetrics();
  updateCoverPreview();
  showEditorTab('write');
  autoGrowTitle();
  elements.postTitle.focus();
}

function beginNewPost() {
  if (!confirmDiscard()) return;
  switchView('posts');
  state.isNewPost = true;
  state.currentPost = {
    id: null,
    fileName: '尚未保存',
    hash: null,
    fields: {
      title: '',
      date: nowDateTimeLocal().replace('T', ' ') + ':00',
      categories: [],
      tags: [],
      cover: '',
      description: '',
      status: 'draft',
    },
    body: '',
  };
  fillEditor(state.currentPost);
  elements.editorMode.textContent = 'NEW MARKDOWN DRAFT';
  markDirty();
  renderPostList();
}

function markDirty() {
  state.dirty = true;
  elements.saveState.textContent = state.isNewPost ? '新草稿尚未保存' : '有尚未保存的修改';
  elements.saveState.classList.add('is-dirty');
}

function markClean() {
  state.dirty = false;
  elements.saveState.textContent = '所有修改已保存';
  elements.saveState.classList.remove('is-dirty');
}

function autoGrowTitle() {
  elements.postTitle.style.height = 'auto';
  elements.postTitle.style.height = `${Math.max(64, elements.postTitle.scrollHeight)}px`;
}

function updateEditorMetrics() {
  const words = elements.postBody.value.replace(/\s+/g, '').length;
  elements.wordCount.textContent = `${words.toLocaleString('zh-CN')} 字`;
  elements.descriptionCount.textContent = `${elements.postDescription.value.length} / 500`;
  if (!elements.markdownPreview.classList.contains('is-hidden')) {
    elements.markdownPreview.innerHTML = renderMarkdown(elements.postBody.value);
  }
}

function mediaForPath(value) {
  return state.media.find((item) => item.url === value);
}

function mediaFileUrl(media) {
  return `/api/media/file/${encodeURIComponent(media.id)}?token=${encodeURIComponent(token)}`;
}

function previewSource(value) {
  const media = mediaForPath(value);
  return media ? mediaFileUrl(media) : '';
}

function paintPreview(container, value, label) {
  container.replaceChildren();
  container.style.background = '';
  const source = previewSource(value);
  if (source) {
    const image = document.createElement('img');
    image.src = source;
    image.alt = label;
    container.append(image);
    return;
  }
  if (/^(linear|radial)-gradient\(/.test(value)) {
    container.style.background = value;
    const span = document.createElement('span');
    span.textContent = label;
    container.append(span);
    return;
  }
  const span = document.createElement('span');
  span.textContent = value ? '外链图片（保存后在博客预览）' : label;
  container.append(span);
}

function updateCoverPreview() {
  paintPreview(elements.postCoverPreview, elements.postCover.value.trim(), '暂无封面');
}

function postPayload() {
  return {
    title: elements.postTitle.value.trim(),
    date: elements.postDate.value,
    categories: elements.postCategory.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
    tags: elements.postTags.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
    description: elements.postDescription.value.trim(),
    cover: elements.postCover.value.trim(),
    status: elements.postStatus.value,
    body: elements.postBody.value,
    originalHash: state.currentPost?.hash,
  };
}

async function saveCurrentPost() {
  const payload = postPayload();
  try {
    elements.savePost.disabled = true;
    elements.saveState.textContent = '正在写入 Markdown…';
    let response = state.isNewPost
      ? await api('/api/posts', { method: 'POST', body: JSON.stringify(payload) })
      : await api(`/api/posts/${encodeURIComponent(state.currentPost.id)}`, { method: 'PUT', body: JSON.stringify(payload) });
    if (response.post.status !== payload.status) {
      response = await api(`/api/posts/${encodeURIComponent(response.post.id)}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: payload.status, originalHash: response.post.hash }),
      });
    }
    state.currentPost = response.post;
    state.isNewPost = false;
    markClean();
    showToast('文章已安全保存');
    await Promise.all([loadPosts(true), refreshStatus(true)]);
    fillEditor(response.post);
  } catch (error) {
    elements.saveState.textContent = '保存失败';
    elements.saveState.classList.add('is-dirty');
    showToast(error.message);
  } finally {
    elements.savePost.disabled = false;
  }
}

function historyReason(reason) {
  if (reason === 'save') return '保存前版本';
  if (reason?.startsWith('status:')) return `状态切换 · ${reason.slice(7)}`;
  if (reason?.startsWith('restore:')) return '恢复操作前版本';
  return reason || '历史版本';
}

async function openHistory() {
  if (!state.currentPost || state.isNewPost) {
    showToast('请先保存文章，再查看版本历史');
    return;
  }
  if (state.dirty) {
    showToast('请先保存当前修改，再比较历史版本');
    return;
  }
  elements.historyList.innerHTML = '<p class="empty-note">正在读取历史…</p>';
  elements.historyDiff.innerHTML = '<p class="empty-note">选择一个版本查看差异。</p>';
  elements.historyDialog.showModal();
  try {
    const response = await api(`/api/posts/${encodeURIComponent(state.currentPost.id)}/history`);
    if (response.history.length === 0) {
      elements.historyList.innerHTML = '<p class="empty-note">还没有历史版本。下一次保存前会自动保留当前内容。</p>';
      return;
    }
    elements.historyList.replaceChildren(...response.history.map((entry) => {
      const button = document.createElement('button');
      button.className = 'history-version';
      button.type = 'button';
      button.innerHTML = '<strong></strong><small></small>';
      button.querySelector('strong').textContent = historyReason(entry.reason);
      button.querySelector('small').textContent = new Date(entry.createdAt).toLocaleString('zh-CN', { hour12: false });
      button.addEventListener('click', () => loadHistoryDiff(entry.id, button));
      return button;
    }));
  } catch (error) {
    elements.historyList.innerHTML = `<p class="empty-note">${escapeHtml(error.message)}</p>`;
  }
}

async function loadHistoryDiff(versionId, button) {
  state.selectedHistoryId = versionId;
  $$('.history-version').forEach((item) => item.classList.toggle('is-active', item === button));
  elements.historyDiff.innerHTML = '<p class="empty-note">正在计算差异…</p>';
  try {
    const response = await api(`/api/posts/${encodeURIComponent(state.currentPost.id)}/history/${encodeURIComponent(versionId)}`);
    const wrapper = document.createElement('div');
    const toolbar = document.createElement('div');
    toolbar.className = 'diff-toolbar';
    const label = document.createElement('strong');
    label.textContent = `${historyReason(response.diff.version.reason)} · ${new Date(response.diff.version.createdAt).toLocaleString('zh-CN', { hour12: false })}`;
    const restore = document.createElement('button');
    restore.className = 'danger-button';
    restore.type = 'button';
    restore.textContent = '恢复此版本';
    restore.addEventListener('click', () => restoreHistory(versionId));
    toolbar.append(label, restore);
    wrapper.append(toolbar);
    for (const item of response.diff.lines) {
      const line = document.createElement('div');
      line.className = `diff-line diff-line--${item.type}`;
      const oldNumber = document.createElement('span');
      const newNumber = document.createElement('span');
      const marker = document.createElement('span');
      const code = document.createElement('code');
      oldNumber.textContent = item.old || '';
      newNumber.textContent = item.new || '';
      marker.textContent = item.type === 'add' ? '+' : item.type === 'remove' ? '−' : ' ';
      code.textContent = item.line || ' ';
      line.append(oldNumber, newNumber, marker, code);
      wrapper.append(line);
    }
    elements.historyDiff.replaceChildren(wrapper);
  } catch (error) {
    elements.historyDiff.innerHTML = `<p class="empty-note">${escapeHtml(error.message)}</p>`;
  }
}

async function restoreHistory(versionId) {
  if (!window.confirm('恢复会先保存当前版本，再把文章内容切换到所选历史版本。确定继续吗？')) return;
  try {
    const response = await api(`/api/posts/${encodeURIComponent(state.currentPost.id)}/history/${encodeURIComponent(versionId)}`, {
      method: 'POST',
      body: JSON.stringify({ originalHash: state.currentPost.hash }),
    });
    state.currentPost = response.post;
    fillEditor(response.post);
    elements.historyDialog.close();
    await Promise.all([loadPosts(true), loadHealth(true), refreshStatus(true)]);
    showToast('历史版本已恢复；恢复前内容也已保留');
  } catch (error) {
    showToast(error.message);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function inlineMarkdown(value) {
  return value
    .replace(/!\[([^\]]*)]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function renderMarkdown(markdown) {
  const escaped = escapeHtml(markdown);
  const codeBlocks = [];
  const withoutCode = escaped.replace(/```[^\n]*\n([\s\S]*?)```/g, (_, code) => {
    const index = codeBlocks.push(`<pre><code>${code.trimEnd()}</code></pre>`) - 1;
    return `\n@@CODE${index}@@\n`;
  });
  const output = [];
  let listOpen = false;
  let paragraph = [];
  const flushParagraph = () => {
    if (paragraph.length) output.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (listOpen) output.push('</ul>');
    listOpen = false;
  };

  for (const rawLine of withoutCode.split(/\r?\n/)) {
    const line = rawLine.trim();
    const code = line.match(/^@@CODE(\d+)@@$/);
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (code) {
      flushParagraph(); closeList(); output.push(codeBlocks[Number(code[1])]); continue;
    }
    if (heading) {
      flushParagraph(); closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    if (line.startsWith('>')) {
      flushParagraph(); closeList();
      output.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ''))}</blockquote>`);
      continue;
    }
    if (bullet) {
      flushParagraph();
      if (!listOpen) { output.push('<ul>'); listOpen = true; }
      output.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      continue;
    }
    if (!line) {
      flushParagraph(); closeList(); continue;
    }
    paragraph.push(line);
  }
  flushParagraph(); closeList();
  return output.join('');
}

function showEditorTab(name) {
  $$('[data-editor-tab]').forEach((button) => button.classList.toggle('is-active', button.dataset.editorTab === name));
  elements.postBody.classList.toggle('is-hidden', name !== 'write');
  elements.markdownPreview.classList.toggle('is-hidden', name !== 'preview');
  if (name === 'preview') elements.markdownPreview.innerHTML = renderMarkdown(elements.postBody.value);
}

async function loadMedia(force = false) {
  if (state.media.length > 0 && !force) {
    renderMedia();
    return;
  }
  try {
    const response = await api('/api/media');
    state.media = response.media;
    renderMedia();
    updateCoverPreview();
  } catch (error) {
    showToast(error.message);
  }
}

function readableBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function makeMediaCard(media, picker = false) {
  const card = document.createElement('article');
  card.className = 'media-card';
  card.innerHTML = `
    <div class="media-card__image"><img alt="" loading="lazy"></div>
    <div class="media-card__info"><strong></strong><small></small><small class="media-card__alt"></small></div>
    <div class="media-card__actions"><button type="button">复制</button><button type="button">插入正文</button><button type="button">设为封面</button><button type="button">加工</button></div>
  `;
  const image = card.querySelector('img');
  image.src = mediaFileUrl(media);
  image.alt = media.name;
  card.querySelector('strong').textContent = media.name;
  card.querySelector('small').textContent = `${readableBytes(media.bytes)} · ${media.url}`;
  card.querySelector('.media-card__alt').textContent = media.alt || '尚未填写替代文本';
  const [copyButton, insertButton, useButton, workshopButton] = card.querySelectorAll('button');
  copyButton.addEventListener('click', async (event) => {
    event.stopPropagation();
    await navigator.clipboard.writeText(media.url);
    showToast(`已复制：${media.url}`);
  });
  insertButton.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!state.currentPost) {
      showToast('请先打开或新建一篇文章');
      return;
    }
    const markdown = `![${media.alt || media.name.replace(/\.[^.]+$/, '')}](${media.url})`;
    const start = elements.postBody.selectionStart;
    const end = elements.postBody.selectionEnd;
    elements.postBody.setRangeText(markdown, start, end, 'end');
    markDirty();
    updateEditorMetrics();
    switchView('posts');
    showToast('图片已插入正文');
  });
  useButton.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!state.currentPost) {
      showToast('请先打开或新建一篇文章');
      return;
    }
    elements.postCover.value = media.url;
    updateCoverPreview();
    markDirty();
    switchView('posts');
    showToast('已设为当前文章封面');
  });
  workshopButton.addEventListener('click', (event) => {
    event.stopPropagation();
    openImageWorkshop(media);
  });
  if (picker) {
    card.querySelector('.media-card__actions').remove();
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    const choose = () => chooseMedia(media);
    card.addEventListener('click', choose);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') choose();
    });
  }
  return card;
}

function renderMedia() {
  const query = elements.mediaSearch.value.trim().toLocaleLowerCase('zh-CN');
  const visible = state.media.filter((media) => !query || media.name.toLocaleLowerCase('zh-CN').includes(query));
  elements.mediaCount.textContent = state.media.length;
  elements.mediaGrid.replaceChildren(...visible.map((media) => makeMediaCard(media)));
  if (visible.length === 0) elements.mediaGrid.innerHTML = '<p class="empty-note">没有匹配的素材。</p>';
}

async function loadHealth(force = false) {
  if (state.health && !force) {
    renderHealth();
    return;
  }
  try {
    const response = await api('/api/health');
    state.health = response.health;
    renderHealth();
  } catch (error) {
    elements.healthQueue.innerHTML = `<p class="empty-note">${escapeHtml(error.message)}</p>`;
    showToast(error.message);
  }
}

function renderHealth() {
  if (!state.health) return;
  const values = [
    state.health.summary.published,
    state.health.summary.pending,
    state.health.summary.drafts,
    state.health.summary.issues,
  ];
  [...elements.healthSummary.querySelectorAll('strong')].forEach((element, index) => {
    element.textContent = values[index];
  });
  const issues = state.health.issues.filter((issue) => (
    state.healthFilter === 'all'
    || issue.severity === state.healthFilter
    || issue.type === state.healthFilter
  ));
  elements.healthIssueCount.textContent = `${issues.length} 项`;
  if (issues.length === 0) {
    elements.healthQueue.innerHTML = '<p class="empty-note">这个筛选下没有待处理问题。</p>';
    return;
  }
  const typeLabels = {
    'missing-description': '摘要',
    'missing-cover': '封面',
    'singleton-tag': '标签',
    'insecure-link': '链接',
    'similar-title': '重复',
  };
  elements.healthQueue.replaceChildren(...issues.map((issue) => {
    const item = document.createElement('article');
    item.className = `health-item health-item--${issue.severity}`;
    item.innerHTML = '<span class="health-item__type"></span><div><h3></h3><p></p></div><button class="outline-button" type="button">打开文章</button>';
    item.querySelector('.health-item__type').textContent = `${typeLabels[issue.type] || issue.type} / ${issue.status}`;
    item.querySelector('h3').textContent = issue.title;
    item.querySelector('p').textContent = issue.message;
    item.querySelector('button').addEventListener('click', () => {
      switchView('posts');
      openPost(issue.postId);
    });
    return item;
  }));
}

function openMediaPicker(target) {
  state.pickerTarget = target;
  loadMedia().then(() => {
    elements.mediaPickerGrid.replaceChildren(...state.media.map((media) => makeMediaCard(media, true)));
    elements.mediaDialog.showModal();
  });
}

function chooseMedia(media) {
  const target = state.pickerTarget;
  if (target === 'postCover') {
    elements.postCover.value = media.url;
    updateCoverPreview();
    markDirty();
  } else if (['indexImg', 'defaultTopImg', 'defaultCover', 'avatar'].includes(target)) {
    elements[target].value = media.url;
    updateVisualPreviews();
  }
  elements.mediaDialog.close();
  showToast(`已选择 ${media.name}`);
}

function fileDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const workshopVariants = {
  wide: { ratio: 16 / 9, width: 1600, height: 900, suffix: 'wide' },
  card: { ratio: 4 / 3, width: 1200, height: 900, suffix: 'card' },
  square: { ratio: 1, width: 900, height: 900, suffix: 'square' },
};

function drawCroppedImage(canvas, image, variant) {
  const zoom = Number(elements.workshopZoom.value) / 100;
  const focusX = Number(elements.workshopX.value) / 100;
  const focusY = Number(elements.workshopY.value) / 100;
  const previewWidth = canvas === elements.workshopCanvas ? Math.min(960, variant.width) : variant.width;
  const previewHeight = Math.round(previewWidth / variant.ratio);
  canvas.width = previewWidth;
  canvas.height = previewHeight;
  const baseScale = Math.max(previewWidth / image.naturalWidth, previewHeight / image.naturalHeight);
  const scale = baseScale * zoom;
  const drawnWidth = image.naturalWidth * scale;
  const drawnHeight = image.naturalHeight * scale;
  const x = -(drawnWidth - previewWidth) * focusX;
  const y = -(drawnHeight - previewHeight) * focusY;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, previewWidth, previewHeight);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, x, y, drawnWidth, drawnHeight);
}

function updateWorkshopPreview() {
  if (!state.workshopImage) return;
  const selected = elements.workshopRatio.value === 'all' ? 'wide' : elements.workshopRatio.value;
  drawCroppedImage(elements.workshopCanvas, state.workshopImage, workshopVariants[selected]);
  elements.workshopXValue.textContent = `${elements.workshopX.value}%`;
  elements.workshopYValue.textContent = `${elements.workshopY.value}%`;
  elements.workshopZoomValue.textContent = `${(Number(elements.workshopZoom.value) / 100).toFixed(2)}×`;
}

function openImageWorkshop(media) {
  state.workshopMedia = media;
  state.workshopImage = null;
  elements.workshopAlt.value = media.alt || '';
  elements.workshopName.value = media.name.replace(/\.[^.]+$/, '');
  elements.workshopRatio.value = 'wide';
  elements.workshopX.value = '50';
  elements.workshopY.value = '50';
  elements.workshopZoom.value = '100';
  const image = new Image();
  image.onload = () => {
    state.workshopImage = image;
    updateWorkshopPreview();
  };
  image.onerror = () => showToast('无法读取这张素材');
  image.src = mediaFileUrl(media);
  elements.imageWorkshopDialog.showModal();
}

function canvasDataUrl(variant) {
  const canvas = document.createElement('canvas');
  drawCroppedImage(canvas, state.workshopImage, variant);
  const dataUrl = canvas.toDataURL('image/webp', 0.84);
  if (!dataUrl.startsWith('data:image/webp;base64,')) throw new Error('当前浏览器无法生成 WebP');
  return dataUrl;
}

async function generateWorkshopImages() {
  if (!state.workshopMedia || !state.workshopImage) throw new Error('原图尚未载入完成');
  const baseName = elements.workshopName.value.trim() || state.workshopMedia.name.replace(/\.[^.]+$/, '');
  const alt = elements.workshopAlt.value.trim();
  const selected = elements.workshopRatio.value;
  const variants = selected === 'all' ? Object.keys(workshopVariants) : [selected];
  await api(`/api/media/${encodeURIComponent(state.workshopMedia.id)}`, {
    method: 'PUT',
    body: JSON.stringify({ alt }),
  });
  const created = [];
  for (const key of variants) {
    const variant = workshopVariants[key];
    const response = await api('/api/media', {
      method: 'POST',
      body: JSON.stringify({
        name: `${baseName}-${variant.suffix}.webp`,
        dataUrl: canvasDataUrl(variant),
        alt,
        width: variant.width,
        height: variant.height,
        variant: key,
      }),
    });
    created.push(response.media);
  }
  await loadMedia(true);
  elements.imageWorkshopDialog.close();
  showToast(`已生成 ${created.length} 张 WebP 封面素材`);
}

async function uploadFiles(files) {
  for (const file of files) {
    try {
      showToast(`正在上传：${file.name}`);
      const dataUrl = await fileDataUrl(file);
      await api('/api/media', {
        method: 'POST',
        body: JSON.stringify({ name: file.name, dataUrl }),
      });
    } catch (error) {
      showToast(`${file.name}：${error.message}`);
      return;
    }
  }
  await loadMedia(true);
  showToast(`已上传 ${files.length} 张图片`);
}

async function loadVisuals(force = false) {
  if (state.visuals && !force) {
    fillVisuals();
    return;
  }
  try {
    await loadMedia();
    const response = await api('/api/visuals');
    state.visuals = response.visuals;
    fillVisuals();
  } catch (error) {
    showToast(error.message);
  }
}

function fillVisuals() {
  if (!state.visuals) return;
  elements.indexImg.value = state.visuals.indexImg;
  elements.defaultTopImg.value = state.visuals.defaultTopImg;
  elements.defaultCover.value = state.visuals.defaultCover[0] || '';
  elements.avatar.value = state.visuals.avatar;
  updateVisualPreviews();
}

function updateVisualPreviews() {
  paintPreview($('#indexImgPreview'), elements.indexImg.value.trim(), '首页背景');
  paintPreview($('#defaultTopImgPreview'), elements.defaultTopImg.value.trim(), '页面顶部');
  paintPreview($('#defaultCoverPreview'), elements.defaultCover.value.trim(), '默认封面');
  paintPreview($('#avatarPreview'), elements.avatar.value.trim(), '头像');
}

async function saveVisuals() {
  try {
    elements.confirmVisual.disabled = true;
    const response = await api('/api/visuals', {
      method: 'PUT',
      body: JSON.stringify({
        originalHash: state.visuals.hash,
        indexImg: elements.indexImg.value.trim(),
        defaultTopImg: elements.defaultTopImg.value.trim(),
        defaultCover: [elements.defaultCover.value.trim()],
        avatar: elements.avatar.value.trim(),
        confirmation: elements.visualConfirmation.value.trim(),
      }),
    });
    state.visuals = response.visuals;
    elements.visualDialog.close();
    fillVisuals();
    showToast('外观设置已保存；原配置已备份');
  } catch (error) {
    showToast(error.message);
    elements.visualConfirmation.focus();
  } finally {
    elements.confirmVisual.disabled = false;
  }
}

async function loadReleaseReport() {
  elements.releaseSummary.innerHTML = '<p class="empty-note">正在读取 Git 差异…</p>';
  try {
    const response = await api('/api/release-report');
    state.releaseReport = response.report;
    renderReleaseReport();
  } catch (error) {
    elements.releaseSummary.innerHTML = `<p class="empty-note">${escapeHtml(error.message)}</p>`;
  }
}

function renderReleaseReport() {
  const report = state.releaseReport;
  if (!report) return;
  elements.releaseSummary.replaceChildren(...[
    ['全部变化', report.totals.changes],
    ['文章', report.totals.content],
    ['素材', report.totals.media],
    ['保护配置', report.totals.protected],
  ].map(([label, value], index) => {
    const item = document.createElement('article');
    if (index === 3 && value > 0) item.className = 'is-danger';
    item.innerHTML = '<span></span><strong></strong>';
    item.querySelector('span').textContent = label;
    item.querySelector('strong').textContent = value;
    return item;
  }));
  const groups = [
    ['内容变化', report.content],
    ['素材变化', report.media],
    ['受保护配置', report.protectedChanges],
    ['工具与依赖', report.infrastructure],
  ];
  const fragment = groups.map(([title, entries]) => {
    const section = document.createElement('section');
    section.className = 'release-group';
    const heading = document.createElement('h4');
    heading.textContent = `${title} · ${entries.length}`;
    section.append(heading);
    if (entries.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-note';
      empty.textContent = '没有变化';
      section.append(empty);
      return section;
    }
    for (const entry of entries.slice(0, 30)) {
      const row = document.createElement('div');
      row.className = 'release-file';
      const code = document.createElement('span');
      const name = document.createElement('span');
      const size = document.createElement('span');
      code.textContent = entry.code;
      name.textContent = entry.title ? `${entry.title} · ${entry.path}` : entry.path;
      size.textContent = entry.url || entry.size || '';
      row.append(code, name, size);
      section.append(row);
    }
    return section;
  });
  const remote = document.createElement('p');
  remote.className = `remote-note${report.remoteConfigured ? ' is-ready' : ''}`;
  remote.textContent = report.remoteConfigured
    ? `源码远端已连接：${report.remote}`
    : '源码仓库尚未配置 origin：远端 artifact 部署与计划发布保持禁用。';
  elements.releaseGroups.replaceChildren(remote, ...fragment);
}

function previewPostUrl() {
  return state.currentPost?.abbrlink
    ? `http://localhost:5000/posts/${encodeURIComponent(state.currentPost.abbrlink)}/`
    : 'http://localhost:5000/';
}

function setPreviewMode(mode) {
  $$('[data-preview-mode]').forEach((button) => button.classList.toggle('is-active', button.dataset.previewMode === mode));
  elements.deviceStage.classList.toggle('is-mobile', mode === 'mobile');
  elements.themePreviewFrame.classList.toggle('is-hidden', mode === 'social');
  elements.socialPreview.classList.toggle('is-hidden', mode !== 'social');
}

async function openRealPreview() {
  if (!state.currentPost || state.isNewPost || state.dirty) {
    showToast('请先保存文章，再打开真实主题预览');
    return;
  }
  try {
    if (!state.currentStatus?.preview.active) {
      await api('/api/preview/start', { method: 'POST', body: '{}' });
      showToast('本地预览正在启动，页面会自动载入');
      await refreshStatus(true);
    }
  } catch (error) {
    if (!/已经在运行/.test(error.message)) {
      showToast(error.message);
      return;
    }
  }
  const url = previewPostUrl();
  elements.themePreviewFrame.src = url;
  elements.previewExternalLink.href = url;
  elements.socialPreviewTitle.textContent = elements.postTitle.value.trim() || '未命名文章';
  elements.socialPreviewDescription.textContent = elements.postDescription.value.trim()
    || elements.postBody.value.replace(/[#>*_`~|-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150)
    || '这篇文章还没有摘要。';
  const cover = previewSource(elements.postCover.value.trim());
  elements.socialPreviewImage.style.backgroundImage = cover ? `url("${cover}")` : '';
  elements.socialPreviewImage.style.backgroundColor = cover ? '' : 'var(--acid)';
  setPreviewMode('desktop');
  elements.previewDialog.showModal();
}

function appendLog(event) {
  if (state.receivedEventIds.has(event.id)) return;
  state.receivedEventIds.add(event.id);
  elements.terminal.querySelector('.terminal__empty')?.remove();
  const line = document.createElement('p');
  line.className = `terminal__line terminal__line--${event.stream}`;
  const time = document.createElement('span');
  time.className = 'terminal__time';
  time.textContent = new Date(event.time).toLocaleTimeString('zh-CN', { hour12: false });
  const source = document.createElement('span');
  source.className = 'terminal__source';
  source.textContent = event.source.toUpperCase();
  const message = document.createElement('span');
  message.className = 'terminal__message';
  message.textContent = event.message;
  line.append(time, source, message);
  elements.terminal.append(line);
  elements.terminal.scrollTop = elements.terminal.scrollHeight;
}

function connectEvents() {
  if (!token) {
    setConnection(false, '缺少访问令牌');
    showToast('请关闭页面，再从启动窗口给出的地址重新打开');
    return;
  }
  const source = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
  source.addEventListener('open', () => setConnection(true, '本机已连接'));
  source.addEventListener('log', (message) => appendLog(JSON.parse(message.data)));
  source.addEventListener('state', () => refreshStatus(true));
  source.addEventListener('error', () => setConnection(false, '正在重连'));
}

async function runAction(action, confirmation) {
  try {
    const response = await api(`/api/actions/${encodeURIComponent(action)}`, {
      method: 'POST',
      body: JSON.stringify({ confirmation }),
    });
    showToast(`已开始：${response.job.label}`);
    await refreshStatus(true);
  } catch (error) {
    showToast(error.message);
  }
}

$$('.nav-item').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
$$('[data-go]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.go)));
elements.refresh.addEventListener('click', async () => {
  await Promise.all([refreshStatus(), loadPosts(true)]);
  if (location.hash === '#media') await loadMedia(true);
  if (location.hash === '#appearance') await loadVisuals(true);
  if (location.hash === '#health') await loadHealth(true);
  if (location.hash === '#operations') await loadReleaseReport();
  showToast('状态已刷新');
});
elements.globalNewPost.addEventListener('click', beginNewPost);
elements.heroNewPost.addEventListener('click', beginNewPost);
elements.newPost.addEventListener('click', beginNewPost);
elements.postSearch.addEventListener('input', renderPostList);
elements.postStatusFilter.addEventListener('change', renderPostList);
elements.postSort.addEventListener('change', renderPostList);
elements.postEditor.addEventListener('submit', (event) => {
  event.preventDefault();
  saveCurrentPost();
});
elements.reloadPost.addEventListener('click', () => {
  if (state.isNewPost) beginNewPost();
  else if (state.currentPost && confirmDiscard()) {
    state.dirty = false;
    openPost(state.currentPost.id, true);
  }
});

for (const input of [
  elements.postTitle,
  elements.postDate,
  elements.postCategory,
  elements.postTags,
  elements.postDescription,
  elements.postCover,
  elements.postStatus,
  elements.postBody,
]) {
  input.addEventListener('input', () => {
    markDirty();
    updateEditorMetrics();
    if (input === elements.postTitle) autoGrowTitle();
    if (input === elements.postCover) updateCoverPreview();
  });
}

$$('[data-editor-tab]').forEach((button) => button.addEventListener('click', () => showEditorTab(button.dataset.editorTab)));
elements.historyButton.addEventListener('click', openHistory);
elements.realPreviewButton.addEventListener('click', openRealPreview);
elements.pickPostCover.addEventListener('click', () => openMediaPicker('postCover'));
elements.mediaSearch.addEventListener('input', renderMedia);
elements.mediaUpload.addEventListener('change', () => {
  const files = [...elements.mediaUpload.files];
  if (files.length) uploadFiles(files);
  elements.mediaUpload.value = '';
});
for (const input of [elements.workshopRatio, elements.workshopX, elements.workshopY, elements.workshopZoom]) {
  input.addEventListener('input', updateWorkshopPreview);
}
elements.workshopForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = elements.workshopForm.querySelector('button[type=submit]');
  try {
    button.disabled = true;
    button.textContent = '正在生成…';
    await generateWorkshopImages();
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
    button.textContent = '生成封面素材';
  }
});
$$('[data-pick-visual]').forEach((button) => button.addEventListener('click', () => openMediaPicker(button.dataset.pickVisual)));
for (const input of [elements.indexImg, elements.defaultTopImg, elements.defaultCover, elements.avatar]) {
  input.addEventListener('input', updateVisualPreviews);
}
elements.visualForm.addEventListener('submit', (event) => {
  event.preventDefault();
  elements.visualConfirmation.value = '';
  elements.visualDialog.showModal();
  window.setTimeout(() => elements.visualConfirmation.focus(), 0);
});
elements.confirmVisual.addEventListener('click', (event) => {
  event.preventDefault();
  if (elements.visualConfirmation.value.trim() !== 'SAVE VISUALS') {
    showToast('确认短语不匹配，配置未保存');
    elements.visualConfirmation.focus();
    return;
  }
  saveVisuals();
});
elements.refreshHealth.addEventListener('click', () => loadHealth(true));
$$('[data-health-filter]').forEach((button) => button.addEventListener('click', () => {
  state.healthFilter = button.dataset.healthFilter;
  $$('[data-health-filter]').forEach((item) => item.classList.toggle('is-active', item === button));
  renderHealth();
}));
elements.refreshReleaseReport.addEventListener('click', loadReleaseReport);
$$('[data-preview-mode]').forEach((button) => button.addEventListener('click', () => setPreviewMode(button.dataset.previewMode)));
$$('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => {
  document.getElementById(button.dataset.closeDialog).close();
}));

elements.previewToggle.addEventListener('click', async () => {
  const active = elements.previewToggle.dataset.active === 'true';
  try {
    await api(active ? '/api/preview/stop' : '/api/preview/start', { method: 'POST', body: '{}' });
    showToast(active ? '正在停止本地预览' : '本地预览正在启动');
    await refreshStatus(true);
  } catch (error) {
    showToast(error.message);
  }
});
for (const button of elements.commandButtons) {
  button.addEventListener('click', () => runAction(button.dataset.action));
}
elements.deployButton.addEventListener('click', () => {
  if (state.releaseReport?.totals.protected > 0) {
    showToast('本次包含受保护配置变化，请先逐项核对发布清单');
  }
  elements.deployConfirmation.value = '';
  elements.deployDialog.showModal();
  window.setTimeout(() => elements.deployConfirmation.focus(), 0);
});
elements.confirmDeploy.addEventListener('click', (event) => {
  event.preventDefault();
  const confirmation = elements.deployConfirmation.value.trim();
  if (confirmation !== 'DEPLOY threeyang.top') {
    showToast('确认短语不匹配，部署未开始');
    elements.deployConfirmation.focus();
    return;
  }
  elements.deployDialog.close();
  runAction('deploy', confirmation);
});
elements.clearLog.addEventListener('click', () => {
  elements.terminal.replaceChildren();
  state.receivedEventIds = new Set();
  const empty = document.createElement('p');
  empty.className = 'terminal__empty';
  empty.textContent = '屏幕已清空；新的命令输出会继续显示。';
  elements.terminal.append(empty);
});

window.addEventListener('beforeunload', (event) => {
  if (!state.dirty) return;
  event.preventDefault();
  event.returnValue = '';
});
window.addEventListener('hashchange', () => switchView(location.hash.slice(1), { updateHash: false }));

switchView(location.hash.slice(1) || 'dashboard', { updateHash: false });
refreshStatus();
loadPosts();
connectEvents();
