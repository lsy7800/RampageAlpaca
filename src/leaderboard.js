class Leaderboard {
  constructor(platform) {
    this.open = false;
    try { this.context = platform.getOpenDataContext(); } catch (error) {}
  }
  send(message) {
    try { if (this.context) this.context.postMessage(message); } catch (error) {}
  }
  sync(score) { this.send({ type: 'sync', score }); }
  resize(scale, pixelRatio) {
    this.width = Math.max(1, Math.round(680 * scale * pixelRatio));
    this.height = Math.max(1, Math.round(940 * scale * pixelRatio));
    // The main domain owns the shared backing buffer; both domains use the
    // same logical 680 x 940 panel coordinates.
    if (this.context) {
      this.context.canvas.width = this.width;
      this.context.canvas.height = this.height;
    }
    this.send({ type: 'resize', width: this.width, height: this.height });
  }
  show(score) {
    this.open = true;
    this.send({ type: 'show', score, width: this.width, height: this.height });
  }
  close() { this.open = false; this.send({ type: 'hide' }); }
  draw(ctx) {
    if (!this.open) return;
    ctx.save();
    ctx.fillStyle = 'rgba(22, 48, 38, 0.85)';
    ctx.fillRect(0, 0, 750, 1334);
    ctx.fillStyle = '#fff7e5';
    ctx.fillRect(35, 190, 680, 940);
    if (this.context) {
      try { ctx.drawImage(this.context.canvas, 35, 190, 680, 940); } catch (error) {}
    } else {
      ctx.fillStyle = '#315746';
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('当前环境暂不支持好友榜', 375, 550);
    }
    ctx.fillStyle = '#315746';
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('关闭排行榜', 375, 1190);
    ctx.restore();
  }
}
module.exports = { Leaderboard };
