export function autoresize(node, value) {
  let resizing = false;
  const resize = () => {
    if (resizing || node.clientWidth === 0) return;
    resizing = true;
    node.style.height = "auto";
    node.style.height = node.scrollHeight + "px";
    requestAnimationFrame(() => {
      resizing = false;
    });
  };
  node.addEventListener("input", resize);
  const ro = new ResizeObserver(() => resize());
  ro.observe(node);
  requestAnimationFrame(resize);
  return {
    update() {
      requestAnimationFrame(resize);
    },
    destroy() {
      node.removeEventListener("input", resize);
      ro.disconnect();
    },
  };
}
