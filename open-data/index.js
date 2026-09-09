// Friend data stays entirely inside the open data context.
const KEY = 'rampage-alpaca-season-1';
const canvas = wx.getSharedCanvas();
const ctx = canvas.getContext('2d');
let visible = false;
let rows = [];
let own = null;
let offset = 0;
let status = '';
let pending = 0;
let syncing = false;
let retry = null;
let generation = 0;
const avatars = {};

function scoreOf(user) {
  const entry = (user.KVDataList || []).find((item) => item.key === KEY);
  const value = entry ? Number(entry.value) : 0;
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
function text(label, x, y, size = 26, color = '#315746') {
  ctx.fillStyle = color;
  ctx.font = size + 'px sans-serif';
  ctx.fillText(label, x, y);
}
function draw() {
  if (!visible) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(canvas.width / 680, 0, 0, canvas.height / 940, 0, 0);
  ctx.clearRect(0, 0, 680, 940);
  ctx.fillStyle = '#fff7e5';
  ctx.fillRect(0, 0, 680, 940);
  ctx.textAlign = 'center';
  text('好友最高分 · 第 1 赛季', 340, 58, 32);
  text(status, 340, 105, 22);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 125, 680, 670); ctx.clip();
  rows.forEach((user, index) => {
    const y = 130 + index * 90 - offset;
    if (y < 40 || y > 795) return;
    const me = own && user.openid === own.openid;
    ctx.fillStyle = me ? '#d9edbe' : '#ffffff';
    ctx.fillRect(15, y, 650, 82);
    ctx.textAlign = 'center';
    text(String(index + 1), 48, y + 50, 30, index < 3 ? '#c58928' : '#315746');
    const url = user.avatarUrl;
    if (url && !avatars[url]) {
      const image = wx.createImage();
      avatars[url] = { image, ready: false };
      image.onload = () => { avatars[url].ready = true; draw(); };
      image.onerror = () => {};
      image.src = url;
    }
    if (url && avatars[url].ready) ctx.drawImage(avatars[url].image, 83, y + 12, 58, 58);
    ctx.textAlign = 'left';
    text((user.nickname || '微信好友').slice(0, 10), 158, y + 49);
    ctx.textAlign = 'right';
    text(String(scoreOf(user)), 638, y + 49, 30);
  });
  ctx.restore();
  ctx.textAlign = 'center';
  const index = own ? rows.findIndex((user) => user.openid === own.openid) : -1;
  text(index >= 0 ? '我的排名：' + (index + 1) + '    最高分：' + scoreOf(rows[index])
    : '个人纪录：' + pending + ' 分 · 排名暂未获取', 340, 855, 25);
  text('上下滑动查看 · 成绩同步可能稍有延迟', 340, 905, 21);
}
function refresh() {
  const request = ++generation;
  status = '正在加载好友成绩…'; draw();
  wx.getUserInfo({ openIdList: ['self'], success: (result) => {
    own = result.data[0] || null;
    if (own) {
      wx.getUserCloudStorage({ keyList: [KEY], success: (data) => {
        if (request !== generation) return;
        own.KVDataList = [{ key: KEY, value: String(Math.max(pending, scoreOf(data))) }];
        mergeOwn(); draw();
      }, fail: () => { draw(); } });
    }
    draw();
  }, fail: () => { own = null; draw(); } });
  wx.getFriendCloudStorage({ keyList: [KEY], success: (result) => {
    if (request !== generation) return;
    rows = result.data.filter((user) => scoreOf(user) > 0)
      .sort((a, b) => scoreOf(b) - scoreOf(a) || String(a.openid).localeCompare(String(b.openid)));
    mergeOwn();
    offset = 0;
    status = rows.length ? '' : '还没有可展示的成绩，邀请好友一起挑战吧';
    draw();
  }, fail: () => {
    if (request !== generation) return;
    status = '加载失败，请关闭后重新打开'; draw();
  } });
}
function mergeOwn() {
  if (!own || !own.openid || !own.KVDataList) return;
  const index = rows.findIndex((user) => user.openid === own.openid);
  if (index < 0) rows.push(own);
  else if (scoreOf(own) > scoreOf(rows[index])) rows[index] = own;
  rows.sort((a, b) => scoreOf(b) - scoreOf(a) || String(a.openid).localeCompare(String(b.openid)));
}
function sync(score) {
  if (Number.isSafeInteger(score) && score >= 0) pending = Math.max(pending, score);
  if (syncing) return;
  syncing = true;
  function failed() {
    syncing = false;
    if (!retry) retry = setTimeout(() => { retry = null; sync(pending); }, 15000);
  }
  wx.getUserCloudStorage({ keyList: [KEY], success: (result) => {
    const target = Math.max(pending, scoreOf(result));
    pending = target;
    if (target === scoreOf(result)) { syncing = false; return; }
    wx.setUserCloudStorage({ KVDataList: [{ key: KEY, value: String(target) }],
      success: () => {
        syncing = false;
        if (visible) refresh();
        if (pending > target) sync(pending);
      }, fail: failed });
  }, fail: failed });
}
wx.onMessage((message) => {
  if (message.type === 'resize' || message.type === 'show') {
    if (Number.isFinite(message.width) && message.width > 0
      && Number.isFinite(message.height) && message.height > 0) {
      // Normally already sized by the main domain. Avoid clearing the shared
      // buffer on every open unless the viewport actually changed.
      if (canvas.width !== message.width) canvas.width = message.width;
      if (canvas.height !== message.height) canvas.height = message.height;
    }
    if (message.type === 'resize') draw();
  }
  if (message.type === 'sync') sync(message.score);
  if (message.type === 'show') { visible = true; sync(message.score); refresh(); }
  if (message.type === 'hide') visible = false;
  if (message.type === 'scroll' && visible) {
    offset = Math.max(0, Math.min(Math.max(0, rows.length * 90 - 665), offset + message.delta));
    draw();
  }
});
