import { ref } from "vue";

/** 全局检查修复弹窗状态 */
export function useGlobalRepair() {
  const globalCheckRepairOpen = ref(false);

  function openGlobalCheckRepair() {
    globalCheckRepairOpen.value = true;
  }

  function closeGlobalCheckRepair() {
    globalCheckRepairOpen.value = false;
  }

  return {
    globalCheckRepairOpen,
    openGlobalCheckRepair,
    closeGlobalCheckRepair,
  };
}
