let activeDialog = null;
let previousOverflow = '';

export function attachDialog(dialog, { onClose = () => {} } = {}) {
  let trigger;
  const close = () => dialog.close();
  dialog.addEventListener('close', () => {
    if (activeDialog === dialog) {
      document.body.style.overflow = previousOverflow;
      activeDialog = null;
    }
    onClose();
    if (trigger?.isConnected) trigger.focus();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
  });
  return {
    open() {
      // 네이티브 대화상자가 배경 조작과 키보드 초점을 관리합니다.
      if (activeDialog && activeDialog !== dialog) activeDialog.close();
      if (dialog.open) return;
      trigger = document.activeElement;
      previousOverflow = document.body.style.overflow;
      activeDialog = dialog;
      document.body.style.overflow = 'hidden';
      dialog.showModal();
    },
    close,
    element: dialog,
  };
}
