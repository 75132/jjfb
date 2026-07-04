import { ref } from "vue";

export type ModalKind = "alert" | "confirm" | "prompt";

export type ModalState = {
  visible: boolean;
  kind: ModalKind;
  title: string;
  message: string;
  defaultValue: string;
  resolve: ((value: boolean | string | null) => void) | null;
};

const modalState = ref<ModalState>({
  visible: false,
  kind: "alert",
  title: "",
  message: "",
  defaultValue: "",
  resolve: null,
});

export function useModalState() {
  return modalState;
}

function openModal(
  kind: ModalKind,
  message: string,
  title: string,
  defaultValue = "",
): Promise<boolean | string | null> {
  return new Promise((resolve) => {
    modalState.value = {
      visible: true,
      kind,
      title,
      message,
      defaultValue,
      resolve,
    };
  });
}

export function appAlert(message: string, title = "提示"): Promise<void> {
  return openModal("alert", message, title).then(() => undefined);
}

export function appConfirm(message: string, title = "确认"): Promise<boolean> {
  return openModal("confirm", message, title).then((v) => Boolean(v));
}

export function appPrompt(message: string, defaultValue = "", title = "输入"): Promise<string | null> {
  return openModal("prompt", message, title, defaultValue).then((v) => (v == null ? null : String(v)));
}

export function closeModal(result: boolean | string | null) {
  const r = modalState.value.resolve;
  modalState.value = {
    visible: false,
    kind: "alert",
    title: "",
    message: "",
    defaultValue: "",
    resolve: null,
  };
  r?.(result);
}
